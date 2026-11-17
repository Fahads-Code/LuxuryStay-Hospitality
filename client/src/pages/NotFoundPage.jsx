import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { useAuth, homeForRole } from '../context/AuthContext.jsx';
import PublicFooter from '../components/PublicFooter.jsx';
import PublicNav from '../components/PublicNav.jsx';

const NotFoundPage = ({ publicPage = false }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const home = user ? homeForRole(user.role) : '/';

  const content = (
    <main className="not-found">
      <span className="not-found-icon">
        <Compass size={30} />
      </span>
      <p className="eyebrow">404 · Off the map</p>
      <h1>This page has checked out.</h1>
      <p>
        The address you followed may have moved, or the reservation has been archived. Let us guide
        you back to somewhere comfortable.
      </p>
      <div className="confirmation-actions">
        <button type="button" className="btn btn-outline" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Go back
        </button>
        <Link to={home} className="btn btn-primary">
          {user ? 'Return to dashboard' : 'Return to the hotel'}
        </Link>
      </div>
    </main>
  );

  if (!publicPage) return content;

  return (
    <div className="site public-page">
      <PublicNav solid />
      {content}
      <PublicFooter />
    </div>
  );
};

export default NotFoundPage;
