import React, { PropTypes } from 'react'
import { Link } from 'react-router'
import { Navbar, Nav, NavDropdown, MenuItem } from 'react-bootstrap'

import LinkMenuItem from '../LinkMenuItem'
import * as Actions from '../../actions'

export default class TopNav extends React.Component {
  static propTypes = {
    user: PropTypes.object,
    envs: PropTypes.array,
    env: PropTypes.object
  };

  get loggedInNav () {
    var self = this

    // user
    var user = this.props.user
    var userText = user.firstName + ' ' + user.lastName + ' (' + user.username + ')'

    // environments
    var path = this.props.location.pathname + this.props.location.search
    var spath = path.split('/')
    var envElements = this.props.envs.map(function (env) {
      spath[1] = env.name
      var onRemove = null
      if (self.props.env && env.name !== self.props.env.name && !env.protected) {
        onRemove = function () {
          self.props.dispatch(Actions.deleteEnvironment(env.name))
        }
      }
      return <LinkMenuItem
        key={env.name}
        to={spath.join('/')}
        active={self.props.env && env.name === self.props.env.name}
        onRemove={onRemove}>
        {env.name}
      </LinkMenuItem>
    })

    // TODO
    // var envCreateModal = null
    // if (this.state.showCreateEnvModal) {
    //  envCreateModal = <EnvCreateModal onHide={this.hideCreateEnvModal} />
    // }

    return (
      <Navbar className={this.props.env && this.props.env.prod ? 'prod' : ''}
        fixedTop fluid>
        <div className='navbar-header pull-left'>
          <Link className='navbar-brand' to='/'>Vili</Link>
        </div>
        <Nav key='user' className='user' pullRight>
          <NavDropdown id='user-dropdown' title={userText}>
            <MenuItem title='Logout' href='/logout'>Logout</MenuItem>
          </NavDropdown>
        </Nav>
        <Nav key='env' className='environment' pullRight>
          <NavDropdown id='env-dropdown'
            title={(this.props.env && this.props.env.name) || <span className='text-danger'>Select Environment</span>}>
            {envElements}
            <MenuItem divider />
            <MenuItem onSelect={this.showCreateEnvModal}>Create Environment</MenuItem>
          </NavDropdown>
        </Nav>
      </Navbar>
    )
  }

  get loggedOutNav () {
    return (
      <Navbar fixedTop fluid>
        <div className='navbar-header pull-left'>
          <Link className='navbar-brand' to='/'>Vili</Link>
        </div>
        <Nav key='user' ulClassName='user' pullRight>
          <MenuItem title='Login' href='/login'>Login</MenuItem>
        </Nav>
      </Navbar>
    )
  }

  render () {
    if (this.props.user) {
      return this.loggedInNav
    }
    return this.loggedOutNav
  }

}
