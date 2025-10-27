/* Remote report storage bridging GitHub Content API.
   Provides CRUD helpers to replace localStorage persistence with a remote file. */
(function(global){
  const DEFAULT_OPTIONS = {
    owner: '',
    repo: '',
    branch: 'main',
    filePath: 'data/reports.json',
    commitPrefix: '[BabySync]',
    getToken: null
  };

  const TYPES = ['feeds', 'elims', 'meds'];
  let config = {...DEFAULT_OPTIONS};
  let lastSnapshot = null;
  let listeners = new Set();

  function assert(cond, msg){
    if(!cond) throw new Error(msg);
  }

  function encodeContent(object){
    const json = JSON.stringify(object, null, 2);
    return typeof btoa === 'function'
      ? btoa(unescape(encodeURIComponent(json)))
      : Buffer.from(json, 'utf8').toString('base64');
  }

  function decodeContent(encoded){
    const json = typeof atob === 'function'
      ? decodeURIComponent(escape(atob(encoded)))
      : Buffer.from(encoded, 'base64').toString('utf8');
    return JSON.parse(json);
  }

  function getToken(){
    if(typeof config.getToken === 'function'){
      const token = config.getToken();
      if(token) return token;
    }
    return null;
  }

  function headers(extra={}){
    const base = {
      Accept: 'application/vnd.github+json'
    };
    const token = getToken();
    if(token){
      base.Authorization = `Bearer ${token}`;
    }
    return {...base, ...extra};
  }

  function apiUrl(){
    const {owner, repo, filePath} = config;
    return `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`;
  }

  function emit(event, payload){
    for(const fn of listeners){
      try { fn(event, payload); }
      catch{ /* ignore */ }
    }
  }

  async function fetchRemote(){
    assert(config.owner && config.repo, 'Remote reports not configured');
    const url = `${apiUrl()}?ref=${encodeURIComponent(config.branch)}`;
    const res = await fetch(url, {headers: headers()});
    if(res.status === 404){
      return {data: emptyPayload(), sha: null, fetchedAt: new Date().toISOString()};
    }
    if(!res.ok){
      throw new Error(`Failed to load remote reports: ${res.status} ${res.statusText}`);
    }
    const payload = await res.json();
    const decoded = decodeContent(payload.content || '');
    return {
      data: normalizePayload(decoded),
      sha: payload.sha,
      fetchedAt: new Date().toISOString()
    };
  }

  async function putRemote(data, sha, message){
    const body = {
      message: buildCommitMessage(message),
      content: encodeContent(data),
      branch: config.branch
    };
    if(sha) body.sha = sha;
    const res = await fetch(apiUrl(), {
      method: 'PUT',
      headers: headers({'Content-Type': 'application/json'}),
      body: JSON.stringify(body)
    });
    if(!res.ok){
      throw new Error(`Failed to write remote reports: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  function buildCommitMessage(message){
    const prefix = config.commitPrefix ? `${config.commitPrefix} ` : '';
    const suffix = message || 'Sync reports';
    return `${prefix}${suffix}`.trim();
  }

  function emptyPayload(){
    return {
      feeds: [],
      elims: [],
      meds: [],
      updatedAt: new Date().toISOString()
    };
  }

  function normalizePayload(data){
    const base = emptyPayload();
    const next = {...base, ...data};
    TYPES.forEach(type => {
      next[type] = Array.isArray(next[type]) ? next[type] : [];
    });
    next.updatedAt = next.updatedAt || new Date().toISOString();
    return next;
  }

  async function withSnapshot(mutator, message){
    const snapshot = await fetchRemote();
    const draft = mutator(structuredClone(snapshot.data));
    if(!draft){
      return snapshot.data;
    }
    draft.updatedAt = new Date().toISOString();
    const result = await putRemote(draft, snapshot.sha, message);
    lastSnapshot = {
      sha: result.content.sha,
      data: draft,
      fetchedAt: new Date().toISOString()
    };
    emit('synced', structuredClone(draft));
    return draft;
  }

  function structuredClone(value){
    return JSON.parse(JSON.stringify(value));
  }

  function uniqueMerge(baseList, incoming, key='id'){
    const seen = new Map();
    for(const item of baseList){
      if(item && item[key]) seen.set(item[key], item);
    }
    for(const item of incoming){
      if(!item || !item[key]) continue;
      seen.set(item[key], item);
    }
    return Array.from(seen.values()).sort((a, b)=>{
      const left = a.dateISO || a.updatedAt || '';
      const right = b.dateISO || b.updatedAt || '';
      return left < right ? 1 : -1;
    });
  }

  const api = {
    configure(options={}){
      config = {...config, ...options};
      lastSnapshot = null;
      emit('configured', structuredClone(config));
    },

    on(listener){
      listeners.add(listener);
      return ()=> listeners.delete(listener);
    },

    async load(){
      lastSnapshot = await fetchRemote();
      emit('loaded', structuredClone(lastSnapshot.data));
      return structuredClone(lastSnapshot.data);
    },

    async saveAll(payload, message){
      assert(payload && typeof payload === 'object', 'saveAll expects an object payload');
      return withSnapshot(()=> normalizePayload(payload), message);
    },

    async addEntry(type, entry, message){
      assert(TYPES.includes(type), `Unknown report type: ${type}`);
      assert(entry && entry.id, 'Entry requires an id');
      return withSnapshot(data=>{
        data[type] = uniqueMerge(data[type], [entry]);
        return data;
      }, message || `Add ${type} entry ${entry.id}`);
    },

    async removeEntry(type, id, message){
      assert(TYPES.includes(type), `Unknown report type: ${type}`);
      return withSnapshot(data=>{
        data[type] = data[type].filter(item => item.id !== id);
        return data;
      }, message || `Remove ${type} entry ${id}`);
    },

    async merge(localData, message){
      assert(localData && typeof localData === 'object', 'merge expects an object payload');
      return withSnapshot(remote=>{
        const incoming = normalizePayload(localData);
        TYPES.forEach(type=>{
          remote[type] = uniqueMerge(remote[type], incoming[type]);
        });
        return remote;
      }, message || 'Merge reports');
    },

    getCached(){
      return lastSnapshot ? structuredClone(lastSnapshot) : null;
    }
  };

  if(typeof module !== 'undefined' && module.exports){
    module.exports = api;
  }else{
    global.RemoteReports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
