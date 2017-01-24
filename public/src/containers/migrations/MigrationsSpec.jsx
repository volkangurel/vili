import React from 'react'
import { viliApi } from '../../lib'
import Loading from '../../components/Loading'

export default class MigrationsSpec extends React.Component {
  constructor (props) {
    super(props)

    this.loadData = this.loadData.bind(this)
  }

  render () {
    if (!this.state || !this.state.podSpec) {
      return <Loading />
    }
    return (
      <div className='col-md-8'>
        <div id='source-yaml'>
          <pre><code>
            {this.state.podSpec}
          </code></pre>
        </div>
      </div>
    )
  }

  loadData () {
    var self = this
    viliApi.jobs.get(this.props.params.env, this.props.params.job).then(function (state) {
      self.setState(state)
    })
  }

  componentDidMount () {
    this.props.activateTab('spec')
    this.loadData()
  }
}
