import React from 'react'
import { Button, ButtonToolbar } from 'react-bootstrap'
import { Link } from 'react-router'
import { Promise } from 'bluebird'
import _ from 'underscore'
import { viliApi, displayTime } from '../lib'
import Table from '../components/Table'
import Loading from '../components/Loading'

class Row extends React.Component {
  constructor (props) {
    super(props)
    this.state = {}

    this.loadData = this.loadData.bind(this)
    this.approveTag = this.approveTag.bind(this)
    this.unapproveTag = this.unapproveTag.bind(this)
  }

  render () {
    var actions = []
    if (this.props.env.approval) {
      if (this.state.approval) {
        actions.push(<button type='button' className='btn btn-xs btn-danger' onClick={this.unapproveTag}>Unapprove</button>)
      } else {
        actions.push(<button type='button' className='btn btn-xs btn-success' onClick={this.approveTag}>Approve</button>)
      }
    }

    var cells = _.union([
      <td data-column='name'>
        <Link to={`/${this.props.env.name}/apps/${this.props.name}`}>{this.props.name}</Link>
      </td>,
      <td data-column='tag'>{this.state.tag}</td>,
      <td data-column='replicas'>{this.state.replicas}</td>,
      <td data-column='deployed_at'>{this.state.deployed_at}</td>
    ], this.props.env.approval ? [
      <td data-column='approved'>{this.state.approvalContents}</td>,
      <td data-column='actions'>{actions}</td>
    ] : [])

    return <tr>{cells}</tr>
  }

  loadData () {
    var self = this
    if (this.props.replicaSet) {
      var replicaSet = this.props.replicaSet
      this.state.tag = replicaSet.spec.template.spec.containers[0].image.split(':')[1]
      this.state.deployed_at = displayTime(new Date(replicaSet.metadata.creationTimestamp))
      this.state.replicas = replicaSet.status.replicas + '/' + replicaSet.spec.replicas
            // TODO count running/ready pods
      this.setState(this.state)
    }
    if (this.props.env.approval && this.state.tag) {
      var db = this.props.db.child('releases').child(this.props.name).child(this.state.tag)
      db.off()
      db.on('value', function (snapshot) {
        var approval = snapshot.val()
        var approvalContents = []
        if (approval) {
          approvalContents.push(<span>{displayTime(new Date(approval.time)) + ' by ' + approval.username}</span>)
          if (approval.url) {
            approvalContents.push(<br />)
            approvalContents.push(<a href={approval.url} target='_blank'>release notes</a>)
          }
        }
        self.setState({
          approval: approval,
          approvalContents: approvalContents
        })
      })
    }
  }

  componentDidMount () {
    this.loadData()
  }

  componentDidUpdate (prevProps) {
    if (this.props != prevProps) {
      this.state = {}
      this.forceUpdate()
      this.loadData()
    }
  }

  componentWillUnmount () {
    if (this.props.approvalDB) {
      this.props.approvalDB.child(this.props.data.name).off()
    }
  }

  approveTag () {
    var url = prompt('Please enter the release url')
    if (!url) {
      return
    }
    viliApi.releases.create(this.props.name, this.state.tag, {
      url: url
    })
  }

  unapproveTag () {
    viliApi.releases.delete(this.props.name, this.state.tag)
  }
}

export class AppsList extends React.Component {
  constructor (props) {
    super(props)
    this.state = {}

    this.loadData = this.loadData.bind(this)
    this.approveAllTags = this.approveAllTags.bind(this)
    this.unapproveAllTags = this.unapproveAllTags.bind(this)
  }

  render () {
    var self = this
    var header = [
      <ol className='breadcrumb'>
        <li><Link to={`/${this.props.params.env}`}>{this.props.params.env}</Link></li>
        <li className='active'>Apps</li>
      </ol>
    ]
    if (!this.state.apps) {
      return (
        <div>
          <div className='view-header'>{header}</div>
          <Loading />
        </div>
      )
    }
    var columns = _.union([
            {title: 'Name', key: 'name'},
            {title: 'Tag', key: 'tag'},
            {title: 'Replicas', key: 'replicas'},
            {title: 'Deployed', key: 'deployed_at'}
    ], this.state.env.approval ? [
            {title: 'Approved', key: 'approved'},
            {title: 'Actions', key: 'actions'}
    ] : [])

    var env = _.findWhere(window.appconfig.envs, {name: this.props.params.env})
    var rows = _.map(
            env.apps, function (appName) {
              return {
                _row: <Row name={appName}
                  replicaSet={self.state.apps.replicaSets[appName]}
                  env={self.state.env}
                  db={self.props.db}
                  ref={'row-' + appName}
                          />
              }
            })

    if (self.state.env.approval) {
      header.push(<ButtonToolbar pullRight>
        <Button onClick={this.approveAllTags} bsStyle='success' bsSize='small'>Approve All</Button>
        <Button onClick={this.unapproveAllTags} bsStyle='danger' bsSize='small'>Unapprove All</Button>
      </ButtonToolbar>)
    }

    return (
      <div>
        <div className='view-header'>{header}</div>
        <Table columns={columns} rows={rows} />
      </div>
    )
  }

  loadData () {
    var self = this
    Promise.props({
      apps: viliApi.apps.get(this.props.params.env)
    }).then(function (state) {
      state.env = _.findWhere(window.appconfig.envs, {name: self.props.params.env})
      self.setState(state)
    })
  }

  componentDidMount () {
    this.props.activateSideNavItem(['apps'])
    this.loadData()
  }

  componentDidUpdate (prevProps) {
    if (this.props != prevProps) {
      this.state = {}
      this.forceUpdate()
      this.loadData()
    }
  }

  approveAllTags () {
    var url = prompt('Please enter the release url')
    if (!url) {
      return
    }
    var self = this
    var env = _.findWhere(window.appconfig.envs, {name: this.props.params.env})
    _.each(env.apps, function (appName) {
      var replicaSet = self.state.apps.replicaSets[appName]
      if (!replicaSet) {
        return
      }
      var row = self.refs['row-' + appName]
      if (row && row.state.tag && !row.state.approval) {
        var app = replicaSet.metadata.name
        var tag = replicaSet.spec.template.spec.containers[0].image.split(':')[1]
        viliApi.releases.create(app, tag, {
          url: url
        })
      }
    })
  }

  unapproveAllTags () {
    if (!confirm('Are you sure you want to unapprove all tags?')) {
      return
    }
    var self = this
    var env = _.findWhere(window.appconfig.envs, {name: this.props.params.env})
    _.each(env.apps, function (appName) {
      var replicaSet = self.state.apps.replicaSets[appName]
      if (!replicaSet) {
        return
      }
      var row = self.refs['row-' + appName]
      if (row && row.state.tag && row.state.approval) {
        var app = replicaSet.metadata.name
        var tag = replicaSet.spec.template.spec.containers[0].image.split(':')[1]
        viliApi.releases.delete(app, tag)
      }
    })
  }

}
