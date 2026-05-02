import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Players from './pages/Players'
import RandomDoubles from './pages/RandomDoubles'
import FixedDoubles from './pages/FixedDoubles'
import Singles from './pages/Singles'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="players" element={<Players />} />
          <Route path="random-doubles" element={<RandomDoubles />} />
          <Route path="fixed-doubles" element={<FixedDoubles />} />
          <Route path="singles" element={<Singles />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
