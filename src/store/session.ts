import { readonly, ref } from 'vue'
import { ApiError, api, forgetToken, hasToken, rememberToken, setUnauthorizedHandler, stripTokenFromUrl, type Me } from './api'

export type SessionState = 'loading' | 'ready' | 'invalid' | 'error'

const me = ref<Me | null>(null)
const state = ref<SessionState>(hasToken ? 'loading' : 'invalid')

// any 401, from any page, ends the session: the family was removed or the staff token was changed
setUnauthorizedHandler(() => {
  forgetToken()
  stripTokenFromUrl()
  me.value = null
  state.value = 'invalid'
})

if (hasToken) {
  api
    .me()
    .then((result) => {
      me.value = result
      state.value = 'ready'
      // remembered only once accepted, so a mistyped link does not replace a working one; from now on the URL no longer needs the token
      rememberToken()
      stripTokenFromUrl()
    })
    .catch((e: unknown) => {
      // on a network error the token stays in the URL, so reloading the page can retry
      if (!(e instanceof ApiError && e.status === 401)) state.value = 'error'
    })
}

/** Who is logged in (`me`, set once `state` is `ready`) and the state of the login check. */
export function useSession() {
  return { me: readonly(me), state: readonly(state) }
}
