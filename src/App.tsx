import { AppDataProvider } from './context/AppDataContext';
import { AppLayout } from './components/layout/AppLayout';

function App() {
  return (
    <AppDataProvider>
      <AppLayout />
    </AppDataProvider>
  );
}

export default App;
