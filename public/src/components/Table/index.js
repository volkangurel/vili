import React, { PropTypes } from 'react'
import { Table } from 'react-bootstrap'
import _ from 'underscore'

export default class ViliTable extends React.Component {

  static propTypes = {
    rows: PropTypes.array,
    columns: PropTypes.array,
    multiselect: PropTypes.bool,
    isSelectAll: PropTypes.bool,
    fill: PropTypes.bool,
    onRowSelection: PropTypes.func,
    shouldRenderCheckbox: PropTypes.func
  }

  render () {
    var headerCells = []
    var subheaderCells = []
    var keys = []
    var hasSubheaders = false
    _.each(this.props.columns, function (col, ix) {
      if (col.subcolumns) {
        headerCells.push(
          <th key={'header-' + ix} colSpan={col.subcolumns.length}>{col.title}</th>)
        _.each(col.subcolumns, function (subcol) {
          subheaderCells.push(<th key={'subheader-' + ix} data-column={subcol.key}>{subcol.title}</th>)
          keys.push(subcol.key)
        })
        hasSubheaders = true
      } else {
        headerCells.push(<th key={'header-' + ix} data-column={col.key}>{col.title}</th>)
        subheaderCells.push(<th key={'subheader-' + ix} />)
        keys.push(col.key)
      }
      return
    })

    var header = [<tr key='header-row'>{headerCells}</tr>]
    if (hasSubheaders) {
      header.push(<tr key='subheader-row'>{subheaderCells}</tr>)
    }
    var rows = _.map(this.props.rows, function (row, ix) {
      if (!row) {
        return null
      }
      if (row.component) {
        return row.component
      }
      var cells = _.map(keys, function (key) {
        return <td key={key} data-column={key}>{row[key]}</td>
      })
      var className = row._className || ''
      return <tr key={'row-' + ix} className={className}>{cells}</tr>
    })
    return (
      <Table hover fill={this.props.fill}>
        <thead key='thead'>{header}</thead>
        <tbody key='tbody'>{rows}</tbody>
      </Table>
    )
  }
}
