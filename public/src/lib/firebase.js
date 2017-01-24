import Firebase from 'firebase'

export default function (firebaseConfig) {
  const db = new Firebase(firebaseConfig.url)
  db.authWithCustomToken(firebaseConfig.token, function (err) {
    if (err) {
      // TODO show user error saying firebase auth failed
      return
    }
  }, {
    remember: 'sessionOnly'
  })
  return db
}
