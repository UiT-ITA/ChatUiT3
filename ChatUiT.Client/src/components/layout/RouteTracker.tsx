import { useEffect } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { setCurrentRoute, track } from '../../services/telemetryService';

// The route templates of App.tsx, most specific first.
const ROUTE_TEMPLATES = [
  '/chat/new',
  '/chat/:chatId',
  '/chat',
  '/assistants/:assistantId',
  '/assistants',
  '/generate/:generationId',
  '/generate',
  '/settings/:tab',
  '/settings',
  '/help/:section',
  '/help',
  '/admin/:tab/:id',
  '/admin/:tab',
  '/admin',
  '/status',
  '/',
];

/** Records client.page_viewed with the route template on every navigation. Renders nothing. */
const RouteTracker: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    let template = 'unknown';
    let params: Record<string, string | undefined> = {};
    for (const candidate of ROUTE_TEMPLATES) {
      const match = matchPath({ path: candidate, end: true }, location.pathname);
      if (match) {
        template = candidate;
        params = match.params;
        break;
      }
    }

    setCurrentRoute(template);
    track('client.page_viewed', {
      route: template,
      'chat.id': params.chatId,
      'assistant.id': params.assistantId,
    });
  }, [location.pathname]);

  return null;
};

export default RouteTracker;
