import React from 'react'
import { connect } from 'react-redux'

function mapStateToProps (state) {
  return {}
}

@connect(mapStateToProps)
export default class Environment extends React.Component {
  static propTypes = {};

  render () {
    return (
      <div>{this.props.children}</div>
    )
  }
}
