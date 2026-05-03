import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import About from "./pages/About";
import Teams from "./pages/Teams";
import Events from "./pages/Events";
import Rotterdam2026 from "./pages/Rotterdam2026";
import Schedule from "./pages/Schedule";
import Journal from "./pages/Journal";
import JournalArticle from "./pages/JournalArticle";
import Media from "./pages/Media";
import Sponsors from "./pages/Sponsors";
import Support from "./pages/Support";
import Contact from "./pages/Contact";
import SubmissionStatus from "./pages/SubmissionStatus";
import MyDetails from "./pages/MyDetails";
import Privacy from "./pages/Privacy";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MySchedule from "./pages/MySchedule";
import MyFees from "./pages/MyFees";
import MyTravel from "./pages/MyTravel";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function Router() {
  return (
    <Layout>
      <ScrollToTop />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/about" component={About} />
        <Route path="/teams" component={Teams} />
        <Route path="/events" component={Events} />
        <Route path="/rotterdam-2026" component={Rotterdam2026} />
        <Route path="/fixtures" component={Schedule} />
        <Route path="/journal/:slug" component={JournalArticle} />
        <Route path="/journal" component={Journal} />
        <Route path="/media" component={Media} />
        <Route path="/sponsors" component={Sponsors} />
        <Route path="/support" component={Support} />
        <Route path="/contact" component={Contact} />
        <Route path="/my-submission" component={SubmissionStatus} />
        <Route path="/my-details/:token" component={MyDetails} />
        <Route path="/login" component={Login} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/schedule" component={MySchedule} />
        <Route path="/fees" component={MyFees} />
        <Route path="/travel" component={MyTravel} />
        <Route path="/my-schedule">{() => { window.location.replace(import.meta.env.BASE_URL + "schedule"); return null; }}</Route>
        <Route path="/privacy" component={Privacy} />
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
