import * as Constants from '../constants'

export function activateNav (item, subItem) {
  return {
    type: Constants.ACTIVATE_NAV,
    payload: {
      item: item,
      subItem: subItem
    }
  }
}

export function activateDeploymentTab (tab) {
  return {
    type: Constants.ACTIVATE_DEPLOYMENT_TAB,
    payload: {
      tab: tab
    }
  }
}
