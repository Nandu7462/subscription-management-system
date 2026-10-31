import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

class AppBoundary extends React.Component {
  state = { error: false }
  static getDerivedStateFromError() { return { error: true } }
  render() {
    if (this.state.error) return <main className="fatal"><h1>Something went wrong</h1><p>Reload the workspace to continue.</p><button className="button" onClick={() => window.location.reload()}>Reload</button></main>
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(<React.StrictMode><AppBoundary><App/></AppBoundary></React.StrictMode>)
