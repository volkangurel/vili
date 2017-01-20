import React, { PropTypes } from 'react'
import { Nav } from 'react-bootstrap'
import _ from 'underscore'

import { LinkMenuItem } from '../LinkMenuItem'

export class SideNav extends React.Component {
  static propTypes = {
    env: PropTypes.object,
    activeItem: PropTypes.array
  };

  get navItems () {
    if (!this.prods.env) {
      return
    }
    var env = this.props.env
    var activeItem = this.props.activeItem
    var items = []
    if (!_.isEmpty(this.props.env.deployments)) {
      items.push(
        <LinkMenuItem key='deployments' to={`/${env.name}/deployments`}
          active={activeItem[0] === 'deployments' && !activeItem[1]}>
          Deployments
        </LinkMenuItem>)
      _.map(env.deployments, function (deployment) {
        items.push(
          <LinkMenuItem key={`deployments-${deployment}`} to={`/${env.name}/deployments/${deployment}`} subitem
            active={activeItem[0] === 'deployments' && activeItem[1] === deployment}>
            {deployment}
          </LinkMenuItem>)
      })
    }
    if (env.migrations) {
      items.push(<LinkMenuItem key='migrations' to={`/${env.name}/migrations`}
        active={activeItem[0] === 'migrations'}>Migrations</LinkMenuItem>)
    }
    items.push(<LinkMenuItem key='nodes' to={`/${env.name}/nodes`}
      active={activeItem[0] === 'nodes'}>Nodes</LinkMenuItem>)
    items.push(<LinkMenuItem key='pods' to={`/${env.name}/pods`}
      active={activeItem[0] === 'pods'}>Pods</LinkMenuItem>)
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
