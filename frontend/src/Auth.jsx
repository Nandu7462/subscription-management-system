import { useState } from 'react'
import { Brand, Icon } from './icons'
import { ErrorBanner, Field } from './components'

export default function Auth({ api, signedIn, connectionError, retrySession }) {
  const resetToken = new URLSearchParams(window.location.search).get('token')
  const [mode, setMode] = useState(window.location.pathname === '/reset-password' ? 'reset' : 'login')
  const [values, setValues] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState('')
  const changeMode = next => { setMode(next); setValues({}); setError(null); setMessage('') }
  const headings = { login: 'Welcome back.', register: 'Your next chapter starts here.', forgot: 'Let’s get you back in.', reset: 'A fresh start.' }
  const subtitles = { login: 'Sign in to your subscription workspace.', register: 'Create your customer account to get started.', forgot: 'We’ll email you a secure password reset link.', reset: 'Choose a new password for your account.' }
  return <div className="auth-layout">
    <aside className="auth-story"><Brand/><div className="auth-copy"><span className="eyebrow">LESS ADMIN. MORE MOMENTUM.</span><h1>A clearer view<br/>of every cycle<span>.</span></h1><p>Subscriptions, invoices, and payments.<br/>One workspace that keeps it all moving.</p><div className="auth-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit orbit-three"/><span className="orbit-core"><Icon name="subscriptions" size={40}/></span><span className="orbit-label label-one"><i/> Recurring, simplified</span><span className="orbit-label label-two"><Icon name="check" size={16}/> A little more in sync</span></div></div><span className="auth-copyright">BRIGHTLOOP SOFTWARE · SUBSCRIPTION MANAGEMENT</span></aside>
    <main className="auth-main"><div className="auth-mobile-brand"><Brand/></div><div className="auth-form-wrap"><span className="eyebrow">YOUR WORK, IN THE LOOP</span><h2>{headings[mode]}</h2><p className="auth-subtitle">{subtitles[mode]}</p>
      {connectionError && <ErrorBanner error={connectionError} retry={retrySession}/>}
      {error && <ErrorBanner error={error}/>}
      {message && <div className="success-banner" role="status"><Icon name="check"/>{message}</div>}
      <form onSubmit={async event => {
        event.preventDefault(); setBusy(true); setError(null); setMessage('')
        try {
          if (mode === 'login') signedIn(await api.login(values.email, values.password))
          else if (mode === 'register') {
            await api.request('/auth/register', { method: 'POST', body: values, authenticated: false })
            signedIn(await api.login(values.email, values.password))
          } else if (mode === 'forgot') {
            const result = await api.request('/auth/forgot-password', { method: 'POST', body: { email: values.email }, authenticated: false })
            setMessage(result.message)
          } else {
            if (!resetToken) throw new Error('This reset link is missing its token. Request a new link.')
            await api.request('/auth/reset-password', { method: 'POST', body: { token: resetToken, password: values.password }, authenticated: false })
            window.history.replaceState({}, '', '/')
            changeMode('login'); setMessage('Password updated. Sign in with your new password.')
          }
        } catch (err) { setError(err) } finally { setBusy(false) }
      }}>
        {mode !== 'reset' && <Field field={{ key: 'email', label: 'Email address', type: 'email', required: true, autoComplete: 'email', placeholder: 'you@company.com' }} value={values.email} onChange={(key, value) => setValues(old => ({ ...old, [key]: value }))}/>}
        {mode === 'register' && <Field field={{ key: 'business_name', label: 'Business name', required: true, maxLength: 200, autoComplete: 'organization' }} value={values.business_name} onChange={(key, value) => setValues(old => ({ ...old, [key]: value }))}/>}
        {mode !== 'forgot' && <Field field={{ key: 'password', label: mode === 'reset' ? 'New password' : 'Password', type: 'password', required: true, maxLength: 128, autoComplete: mode === 'login' ? 'current-password' : 'new-password',
          ...(mode !== 'login' ? { minLength: 9, hint: 'At least 9 characters, with uppercase, lowercase and a special character.' } : {}) }} value={values.password} onChange={(key, value) => setValues(old => ({ ...old, [key]: value }))}/>}
        {mode === 'login' && <div className="forgot-row"><button type="button" className="text-button" onClick={() => changeMode('forgot')}>Forgot password?</button></div>}
        <button className="button auth-submit" disabled={busy}>{busy ? 'Please wait…' : ({ login: 'Sign in to workspace', register: 'Create account', forgot: 'Send reset link', reset: 'Update password' })[mode]}<Icon name="arrow" size={18}/></button>
      </form>
      <p className="auth-switch">{mode === 'login' ? <>New to Brightloop? <button className="text-button" onClick={() => changeMode('register')}>Create an account</button></> : <button className="text-button" onClick={() => { window.history.replaceState({}, '', '/'); changeMode('login') }}>Back to sign in</button>}</p>
      <div className="auth-footnote"><Icon name="check" size={15}/> Your workspace. Securely connected.</div>
    </div></main>
  </div>
}
