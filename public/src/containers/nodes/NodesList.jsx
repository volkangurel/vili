import React from 'react'
import { connect } from 'react-redux'
import { Link } from 'react-router'
import { Button } from 'react-bootstrap'
import _ from 'underscore'
import humanSize from 'human-size'

import displayTime from '../../lib/displayTime'
import Table from '../../components/Table'
import Loading from '../../components/Loading'
import { activateNav } from '../../actions/app'
import { subNodes, unsubNodes, setNodeSchedulable } from '../../actions/nodes'

function mapStateToProps (state) {
  return {
    nodes: state.nodes.toJS()
  }
}

@connect(mapStateToProps)
export default class NodesList extends React.Component {

  subData = () => {
    this.props.dispatch(subNodes(this.props.params.env))
  }

  unsubData = () => {
    this.props.dispatch(unsubNodes(this.props.params.env))
  }

  componentDidMount () {
    this.props.dispatch(activateNav('nodes'))
  }

  render () {
    const nodes = (this.props.nodes.envs &&
      this.props.nodes.envs[this.props.params.env]) ||
      []
    const header = (
      <div className='view-header'>
        <ol className='breadcrumb'>
          <li><Link to={`/${this.props.params.env}`}>{this.props.params.env}</Link></li>
          <li className='active'>Nodes</li>
        </ol>
      </div>
    )
    if (this.props.nodes.isFetching) {
      return (
        <div>
          {header}
          <Loading />
        </div>
      )
    }

    var self = this
    var columns = [
      { title: 'Host', key: 'host' },
      { title: 'Instance Type', key: 'instance_type' },
      { title: 'Role', key: 'role' },
      { title: 'Capacity',
        subcolumns: [
          {title: 'CPU', key: 'cpu_capacity'},
          {title: 'Memory', key: 'memory_capacity'},
          {title: 'Pods', key: 'pods_capacity'}
        ]},
      { title: 'Versions',
        subcolumns: [
          {title: 'CoreOS', key: 'os_version'},
          {title: 'Kubelet', key: 'kubelet_version'},
          {title: 'Proxy', key: 'proxy_version'}
        ]},
      { title: 'Created', key: 'created' },
      { title: 'Status', key: 'status' },
      { title: 'Actions', key: 'actions' }
    ]

    const rows = _.map(nodes, function (node) {
      var name = node.metadata.name
      var memory = /(\d+)Ki/g.exec(node.status.capacity.memory)
      if (memory) {
        memory = humanSize(parseInt(memory[1]) * 1024, 1)
      } else {
        memory = node.status.capacity.memory
      }
      var nodeStatuses = []
      if (node.status.conditions[0].status === 'Unknown') {
        nodeStatuses.push('NotReady')
      } else {
        nodeStatuses.push(node.status.conditions[0].type)
      }
      var actions
      if (node.spec.unschedulable === true) {
        actions = (
          <Button bsStyle='success' bsSize='xs'
            onClick={self.setNodeSchedulable.bind(self, name, 'enable')}>
            Enable
          </Button>
        )
        nodeStatuses.push('Disabled')
      } else {
        actions = (
          <Button bsStyle='danger' bsSize='xs'
            onClick={self.setNodeSchedulable.bind(self, name, 'disable')}>
            Disable
          </Button>
        )
      }

      return {
        host: <Link to={`/${self.props.params.env}/nodes/${name}`}>{name}</Link>,
        instance_type: node.metadata.labels['airware.io/instance-type'],
        role: node.metadata.labels['airware.io/role'],
        cpu_capacity: node.status.capacity.cpu,
        memory_capacity: memory,
        pods_capacity: node.status.capacity.pods,
        os_version: node.status.nodeInfo.osImage,
        kubelet_version: node.status.nodeInfo.kubeletVersion,
        proxy_version: node.status.nodeInfo.kubeProxyVersion,
        created: displayTime(new Date(node.metadata.creationTimestamp)),
        status: nodeStatuses.join(','),
        actions: actions
      }
    })

    return (
      <div>
        {header}
        <Table columns={columns} rows={rows} />
      </div>
    )
  }

  setNodeSchedulable = (node, action) => {
    this.props.dispatch(setNodeSchedulable(this.props.params.env, this.props.params.node, action))
  }

}
