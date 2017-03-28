import React, { PropTypes } from 'react'
import _ from 'underscore'

export default class Log extends React.Component {
  static propTypes = {
    log: PropTypes.array
  }

  render () {
    const items = _.map(this.props.log, function (line, ix) {
      return (
        <span key={ix}>{line + '\n'}</span>
      )
    })
    return (
      <div>
        <h4>Log</h4>
        <pre>
          {items}
        </pre>
      </div>
    )
  }
}
