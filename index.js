import { createMap, createStore } from 'nanostores'

let identity = a => a
let storageEngine = {}
let eventsEngine = { addEventListener() {}, removeEventListener() {} }
if (typeof localStorage !== 'undefined') {
  storageEngine = localStorage
}

if (typeof window !== 'undefined') {
  eventsEngine = {
    addEventListener(key, listener) {
      window.addEventListener('storage', listener)
    },
    removeEventListener(key, listener) {
      window.removeEventListener('storage', listener)
    }
  }
}

export function setPersistentEngine(storage, events) {
  storageEngine = storage
  eventsEngine = events
}

export function createPersistentStore(name, initial = undefined, opts = {}) {
  let encode = opts.encode || identity
  let decode = opts.decode || identity
  function listener(e) {
    if (e.key === name) {
      store.set(decode(e.newValue))
    }
  }

  let store = createStore(() => {
    set(storageEngine[name] ? decode(storageEngine[name]) : initial)
    if (opts.listen !== false) {
      eventsEngine.addEventListener(name, listener)
      return () => {
        eventsEngine.removeEventListener(name, listener)
      }
    }
  })

  let set = store.set
  store.set = newValue => {
    if (typeof newValue === 'undefined') {
      delete storageEngine[name]
    } else {
      storageEngine[name] = encode(newValue)
    }
    set(newValue)
  }

  return store
}

export function createPersistentMap(prefix, initial = {}, opts = {}) {
  let encode = opts.encode || identity
  let decode = opts.decode || identity
  function listener(e) {
    if (e.key.startsWith(prefix)) {
      store.setKey(e.key.slice(prefix.length), decode(e.newValue))
    }
  }

  let store = createMap(() => {
    let data = { ...initial }
    for (let key in storageEngine) {
      if (key.startsWith(prefix)) {
        data[key.slice(prefix.length)] = decode(storageEngine[key])
      }
    }
    store.set(data)
    if (opts.listen !== false) {
      if (eventsEngine.perKey) {
        return () => {
          for (let key in store.value) {
            eventsEngine.removeEventListener(prefix + key, listener)
          }
        }
      } else {
        eventsEngine.addEventListener(prefix, listener)
        return () => eventsEngine.removeEventListener(prefix, listener)
      }
    }
  })

  let setKey = store.setKey
  store.setKey = (key, newValue) => {
    if (typeof newValue === 'undefined') {
      if (eventsEngine.perKey) {
        eventsEngine.removeEventListener(prefix + key, listener)
      }
      delete storageEngine[prefix + key]
    } else {
      if (eventsEngine.perKey && !(prefix + key in storageEngine)) {
        eventsEngine.addEventListener(prefix + key, listener)
      }
      storageEngine[prefix + key] = encode(newValue)
    }
    setKey(key, newValue)
  }

  return store
}

let testStorage = {}
let testListeners = []

export function useTestStorageEngine() {
  setPersistentEngine(testStorage, {
    addEventListener(key, cb) {
      testListeners.push(cb)
    },
    removeEventListener(key, cb) {
      testListeners = testListeners.filter(i => i !== cb)
    }
  })
}

export function setTestStorageKey(key, newValue) {
  if (typeof newValue === 'undefined') {
    delete testStorage[key]
  } else {
    testStorage[key] = newValue
  }
  let event = { key, newValue }
  for (let listener of testListeners) {
    listener(event)
  }
}

export function getTestStorage() {
  return testStorage
}

export function cleanTestStorage() {
  for (let i in testStorage) {
    setTestStorageKey(i, undefined)
  }
}
