import { createBrowserRouter } from "react-router-dom";
import Layout from "@/components/Layout";
import DashboardPage from "@/pages/DashboardPage";
import WorkflowDetailPage from "@/pages/WorkflowDetailPage";
import RunResultPage from "@/pages/RunResultPage";
import NotFoundPage from "@/pages/NotFoundPage";

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/workflow/:id", element: <WorkflowDetailPage /> },
      { path: "/run/:id", element: <RunResultPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

export default router;
