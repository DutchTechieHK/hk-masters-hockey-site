import { Switch, Route, Router as WouterRouter } from "wouter";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import About from "./pages/About";
import Teams from "./pages/Teams";
import Events from "./pages/Events";
import Rotterdam2026 from "./pages/Rotterdam2026";
import Media from "./pages/Media";
import Sponsors from "./pages/Sponsors";
import Contact from "./pages/Contact";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/about" component={About} />
        <Route path="/teams" component={Teams} />
        <Route path="/events" component={Events} />
        <Route path="/rotterdam-2026" component={Rotterdam2026} />
        <Route path="/media" component={Media} />
        <Route path="/sponsors" component={Sponsors} />
        <Route path="/contact" component={Contact} />
        <Route>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
              <p className="text-gray-600">Page not found</p>
              <a href={import.meta.env.BASE_URL} className="mt-4 inline-block text-green-700 hover:text-green-900 underline">Go Home</a>
            </div>
          </div>
        </Route>
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router />
    </WouterRouter>
  );
}

export default App;
