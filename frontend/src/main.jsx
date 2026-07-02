import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import RepoListPage from './pages/RepoListPage.jsx';
import RepoDashboardPage from './pages/RepoDashboardPage.jsx';
import PRDetailPage from './pages/PRDetailPage.jsx';
import Layout from './components/Layout.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<RepoListPage />} />
          <Route path="/repos/:repoId" element={<RepoDashboardPage />} />
          <Route path="/prs/:prId" element={<PRDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
