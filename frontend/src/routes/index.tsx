import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';

// 懒加载组件
const LandingApp = lazy(() => import('../landing/LandingApp'));
const HomeMinimal = lazy(() => import('../landing/pages/HomeMinimal'));
const PrivacyPolicy = lazy(() => import('../landing/pages/PrivacyPolicy'));
const Terms = lazy(() => import('../landing/pages/Terms'));
const Support = lazy(() => import('../landing/pages/Support'));
const GameApp = lazy(() => import('../app'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingApp />,
    children: [
      {
        index: true,
        element: <HomeMinimal />,
      },
      {
        path: 'privacy-policy',
        element: <PrivacyPolicy />,
      },
      {
        path: 'terms',
        element: <Terms />,
      },
      {
        path: 'support',
        element: <Support />,
      },
    ],
  },
  {
    path: '/app/*',
    element: <GameApp />,
  },
  // 像素分享链接重定向
  {
    path: '/pixel/:lat/:lng',
    element: <GameApp />,
  },
]);
