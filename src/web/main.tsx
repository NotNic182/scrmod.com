import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App, preloadRoute } from './App'
import '@fontsource-variable/montserrat/wght.css'
import './styles/tokens.css'
import './styles/base.css'

// The entry page's code arrives before the first render, so the page paints once, with its content, instead of
// behind a loading placeholder. A chunk that is slow to come doesn't hold the site back past 1.5 s.
const entryPage = Promise.race([preloadRoute(location.pathname), new Promise((resolve) => setTimeout(resolve, 1500))])

void entryPage.then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
