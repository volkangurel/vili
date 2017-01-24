import HttpClient from './HttpClient'
import _ from 'underscore'

const httpClient = new HttpClient()

const apiUtils = {
  async getDeployments (env, name, qs) {
    if (_.isObject(name)) {
      qs = name
      name = null
    }
    if (name) {
      return await httpClient.get({ url: '/api/v1/envs/' + env + '/deployments/' + name, query: qs })
    }
    return await httpClient.get({ url: '/api/v1/envs/' + env + '/deployments', query: qs })
  },

  async scaleDeployment (env, name, qs) {
    return await httpClient.put({ url: '/api/v1/envs/' + env + '/deployments/' + name + '/scale' })
  }

}

export { httpClient }
export default apiUtils

// class ViliApi {
//   constructor (opts) {
//     this.opts = opts

//     this.jobs = {
//       get: function (env, name, qs) {
//         if (_.isObject(name)) {
//           qs = name
//           name = null
//         }
//         if (name) {
//           return makeGetRequest('/envs/' + env + '/jobs/' + name, qs)
//         }
//         return makeGetRequest('/envs/' + env + '/jobs', qs)
//       }
//     }

//     this.nodes = {
//       get: function (env, name, qs) {
//         if (_.isObject(name)) {
//           qs = name
//           name = null
//         }
//         if (name) {
//           return makeGetRequest('/envs/' + env + '/nodes/' + name, qs)
//         }
//         return makeGetRequest('/envs/' + env + '/nodes', qs)
//       },
//       setSchedulable: function (env, name, onOff) {
//         return makePutRequest('/envs/' + env + '/nodes/' + name + '/' + onOff.toLowerCase())
//       }
//     }

//     this.pods = {
//       get: function (env, name, qs) {
//         if (_.isObject(name)) {
//           qs = name
//           name = null
//         }
//         if (name) {
//           return makeGetRequest('/envs/' + env + '/pods/' + name, qs)
//         }
//         return makeGetRequest('/envs/' + env + '/pods', qs)
//       },
//       delete: function (env, name) {
//         return makeDeleteRequest('/envs/' + env + '/pods/' + name)
//       }
//     }

//     this.services = {
//       create: function (env, app) {
//         return makePostRequest('/envs/' + env + '/apps/' + app + '/service')
//       }
//     }

//     this.deployments = {
//       create: function (env, app, spec) {
//         var qs = ''
//         if (spec.trigger) {
//           qs = '?trigger=true'
//         }
//         return makePostRequest('/envs/' + env + '/apps/' + app + '/deployments' + qs, spec)
//       },
//       setRollout: function (env, app, id, rollout) {
//         return makePutRequest('/envs/' + env + '/apps/' + app + '/deployments/' + id + '/rollout', rollout)
//       },
//       resume: function (env, app, id) {
//         return makePostRequest('/envs/' + env + '/apps/' + app + '/deployments/' + id + '/resume')
//       },
//       pause: function (env, app, id) {
//         return makePostRequest('/envs/' + env + '/apps/' + app + '/deployments/' + id + '/pause')
//       },
//       rollback: function (env, app, id) {
//         return makePostRequest('/envs/' + env + '/apps/' + app + '/deployments/' + id + '/rollback')
//       }
//     }

//     this.runs = {
//       create: function (env, job, spec) {
//         var qs = ''
//         if (spec.trigger) {
//           qs = '?trigger=true'
//         }
//         return makePostRequest('/envs/' + env + '/jobs/' + job + '/runs' + qs, spec)
//       },
//       start: function (env, job, id) {
//         return makePostRequest('/envs/' + env + '/jobs/' + job + '/runs/' + id + '/start')
//       },
//       terminate: function (env, job, id) {
//         return makePostRequest('/envs/' + env + '/jobs/' + job + '/runs/' + id + '/terminate')
//       }
//     }

//     this.releases = {
//       create: function (name, tag, spec) {
//         return makePostRequest('/releases/' + name + '/' + tag, spec)
//       },
//       delete: function (name, tag) {
//         return makeDeleteRequest('/releases/' + name + '/' + tag)
//       }
//     }

//     this.environments = {
//       create: function (spec) {
//         return makePostRequest('/environments', spec)
//       },
//       delete: function (name) {
//         return makeDeleteRequest('/environments/' + name)
//       },
//       branches: function () {
//         return makeGetRequest('/envBranches')
//       },
//       spec: function (name, branch) {
//         return makeGetRequest('/envSpec?name=' + name + '&branch=' + branch)
//       }
//     }
//   }
// }

// export default new ViliApi()
