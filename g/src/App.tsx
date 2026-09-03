import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Studio } from './pages/Studio';
import { PublicStudio } from './pages/PublicStudio';

interface AppProps {
  /** Which Studio mode to land in: the public read, the canvas, or the preview. */
  startMode?: 'view' | 'edit' | 'preview';
  /** Tethyr ships light and dark; both are first-class. */
  appearance?: 'light' | 'dark';
}

export function App({ startMode = 'view', appearance = 'light' }: AppProps) {
  return (
    <div className={appearance === 'dark' ? 'dark h-full min-h-full' : 'h-full min-h-full'}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Studio initialMode={startMode} />} />
          <Route path="/u/:handle" element={<PublicStudio />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>);

}