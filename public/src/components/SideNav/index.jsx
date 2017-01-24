import React, { PropTypes } from 'react'
import { Nav } from 'react-bootstrap'
import _ from 'underscore'

import LinkMenuItem from '../LinkMenuItem'

export default class SideNav extends React.Component {
  static propTypes = {
    env: PropTypes.object,
    nav: PropTypes.object
  };

  get navItems () {
    const { env, nav } = this.props
    if (!env || !nav) {
      return
    }
    var items = []
    if (env.migrations) {
      items.push(<LinkMenuItem key='migrations' to={`/${env.name}/migrations`}
        active={nav.item === 'migrations'}>Migrations</LinkMenuItem>)
    }
    if (!_.isEmpty(this.props.env.deployments)) {
      items.push(
        <LinkMenuItem key='deployments' to={`/${env.name}/deployments`}
          active={nav.item === 'deployments' && !nav.subItem}>
          Deployments
        </LinkMenuItem>)
      _.map(env.deployments, function (deployment) {
        items.push(
          <LinkMenuItem key={`deployments-${deployment}`} to={`/${env.name}/deployments/${deployment}`} subitem
            active={nav.item === 'deployments' && nav.subItem === deployment}>
            {deployment}
          </LinkMenuItem>)
      })
    }
    items.push(<LinkMenuItem key='configmaps' to={`/${env.name}/configmaps`}
      active={nav.item === 'configmaps'}>Config Maps</LinkMenuItem>)
    items.push(<LinkMenuItem key='nodes' to={`/${env.name}/nodes`}
      active={nav.item === 'nodes'}>Nodes</LinkMenuItem>)
    items.push(<LinkMenuItem key='pods' to={`/${env.name}/pods`}
      active={nav.item === 'pods'}>Pods</LinkMenuItem>)
    return items
  }

  render () {
    return (
      <Nav className='side-nav' stacked>
        {this.navItems}
      </Nav>
    )
  }
}
