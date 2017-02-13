import HttpClient from './HttpClient'
import _ from 'underscore'

const httpClient = new HttpClient('/api/v1/')

export { httpClient }
export default {

  deployments: {
    async get (env, name, qs) {
      if (_.isObject(name)) {
        qs = name
        name = null
      }
      if (name) {
        return await httpClient.get({ url: 'envs/' + env + '/deployments/' + name, query: qs })
      }
      return await httpClient.get({ url: 'envs/' + env + '/deployments', query: qs })
    },

    async scale (env, name, replicas) {
      return await httpClient.put({ url: 'envs/' + env + '/deployments/' + name + '/scale', json: { replicas: replicas } })
    }
  },

  migrations: {
    async get (env, qs) {
      return await httpClient.get({ url: 'envs/' + env + '/migrations', query: qs })
    }
  },

  nodes: {
    async get (env, name, qs) {
      if (_.isObject(name)) {
        qs = name
        name = null
      }
      if (name) {
        return await httpClient.get({ url: 'envs/' + env + '/nodes/' + name, query: qs })
      }
      return await httpClient.get({ url: 'envs/' + env + '/nodes', query: qs })
    },

    async setSchedulable (env, name, onOff) {
      return await httpClient.put({ url: 'envs/' + env + '/nodes/' + name + '/' + onOff.toLowerCase() })
    }
  },

  pods: {
    async get (env, name, qs) {
      if (_.isObject(name)) {
        qs = name
        name = null
      }
      if (name) {
        return await httpClient.get({ url: 'envs/' + env + '/pods/' + name, query: qs })
      }
      return await httpClient.get({ url: 'envs/' + env + '/pods', query: qs })
    },
    watch (handler, env, name, qs) {
      if (_.isObject(name)) {
        qs = name
        name = null
      } else if (!qs) {
        qs = {}
      }
      qs.watch = 'true'
      if (name) {
        return httpClient.ws({ url: 'envs/' + env + '/pods/' + name, qs: qs, messageHandler: handler })
      }
      return httpClient.ws({ url: 'envs/' + env + '/pods', qs: qs, messageHandler: handler })
    },
    async del (env, name) {
      return await httpClient.delete({ url: 'envs/' + env + '/pods/' + name })
    }
  },

  services: {
    async create (env, app) {
      return await httpClient.post({ url: 'envs/' + env + '/apps/' + app + '/service' })
    }
  },

  rollouts: {
    async create (env, deployment, spec) {
      const qs = {}
      if (spec.trigger) {
        qs.trigger = 'true'
      }
      return await httpClient.post({ url: 'envs/' + env + '/deployments/' + deployment + '/rollouts', qs: qs, json: spec })
    },
//    async setRollout (env, deployment, id, rollout) {
//      return await httpClient.put({ url: 'envs/' + env + '/deployments/' + deployment + '/rollouts/' + id + '/rollout', json: rollout})
//    },
    async resume (env, deployment, id) {
      return await httpClient.post({ url: 'envs/' + env + '/deployments/' + deployment + '/rollouts/' + id + '/resume' })
    },
    async pause (env, deployment, id) {
      return await httpClient.post({ url: 'envs/' + env + '/deployments/' + deployment + '/rollouts/' + id + '/pause' })
    },
    async rollback (env, deployment, id) {
      return await httpClient.post({ url: 'envs/' + env + '/deployments/' + deployment + '/rollouts/' + id + '/rollback' })
    }
  },

  runs: {
    async create (env, job, spec) {
      const qs = {}
      if (spec.trigger) {
        qs.trigger = 'true'
      }
      return await httpClient.post({ url: 'envs/' + env + '/jobs/' + job + '/runs', qs: qs, json: spec })
    },
    async start (env, job, id) {
      return await httpClient.post({ url: 'envs/' + env + '/jobs/' + job + '/runs/' + id + '/start' })
    },
    async terminate (env, job, id) {
      return await httpClient.post({ url: 'envs/' + env + '/jobs/' + job + '/runs/' + id + '/terminate' })
    }
  },

  releases: {
    async create (name, tag, spec) {
      return await httpClient.post({ url: 'releases/' + name + '/' + tag, json: spec })
    },
    async delete (name, tag) {
      return await httpClient.delete({ url: 'releases/' + name + '/' + tag })
    }
  },

  environments: {
    async create (spec) {
      return await httpClient.post({ url: 'environments', json: spec })
    },
    async delete (name) {
      return await httpClient.delete({ url: 'environments/' + name })
    },
    async branches () {
      return await httpClient.get({ url: 'envBranches' })
    },
    async spec (name, branch) {
      const qs = { name: name, branch: branch }
      return await httpClient.get({ url: 'envSpec', qs: qs })
    }
  }

}
