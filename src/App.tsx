import { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './components/Login';
import { FrontendView } from './components/FrontendView';
import { AdminPanel } from './components/AdminPanel';

type ViewType = 'frontend' | 'admin';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('frontend');

  return (
    <AuthProvider>
      {currentView === 'frontend' ? (
        <FrontendView onLogoClick={() => setCurrentView('admin')} />
      ) : (
        <ProtectedRoute fallback={<Login />}>
          <AdminPanel onNavigateToFrontend={() => setCurrentView('frontend')} />
        </ProtectedRoute>
      )}
    </AuthProvider>
  );
}

export default App;
