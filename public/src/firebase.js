import Firebase from 'firebase'

const db = new Firebase(window.appconfig.firebase.url)
db.authWithCustomToken(window.appconfig.firebase.token, function (err) {
  if (err) {
    // TODO show user error saying firebase auth failed
    return
  }
}, {
  remember: 'sessionOnly'
})

export default db
