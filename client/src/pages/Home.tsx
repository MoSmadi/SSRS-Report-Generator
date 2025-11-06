import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowRight } from "lucide-react";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading, error, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-md text-center space-y-6">
          {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-16 mx-auto" />}
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">{APP_TITLE}</h1>
            <p className="text-slate-600">Create beautiful reports using natural language</p>
          </div>
          <Button
            onClick={() => window.location.href = getLoginUrl()}
            size="lg"
            className="w-full"
          >
            Sign in to Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8" />}
            <h1 className="text-xl font-bold text-slate-900">{APP_TITLE}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">Welcome, {user?.name || "User"}</span>
            <Button variant="outline" size="sm" onClick={logout}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Hero section */}
          <div className="flex flex-col justify-center space-y-6">
            <div>
              <h2 className="text-4xl font-bold text-slate-900 mb-4">
                Build Reports with Natural Language
              </h2>
              <p className="text-lg text-slate-600 mb-6">
                Simply describe what report you want to create, and our AI will handle the rest. Select a data source, preview the generated SQL, and publish your report in minutes.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900">What you can do:</h3>
              <ul className="space-y-2 text-slate-600">
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold">✓</span>
                  <span>Describe reports in plain English</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold">✓</span>
                  <span>AI infers metrics, dimensions, and filters</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold">✓</span>
                  <span>Select from shared data sources</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold">✓</span>
                  <span>Preview generated SQL queries</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold">✓</span>
                  <span>Publish and get shareable render links</span>
                </li>
              </ul>
            </div>

            <Button
              size="lg"
              onClick={() => navigate("/report-builder")}
              className="w-full sm:w-auto"
            >
              Start Building <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {/* Feature cards */}
          <div className="space-y-4">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-lg">Natural Language Processing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">
                  Describe your report in everyday language and let AI extract the relevant metrics, dimensions, and filters.
                </p>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-lg">Smart SQL Generation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">
                  Automatically generate SQL queries based on your data source schema and requirements.
                </p>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50">
              <CardHeader>
                <CardTitle className="text-lg">Instant Publishing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">
                  Publish your reports and get shareable links to distribute to your team.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick start section */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Start</CardTitle>
            <CardDescription>Get started in 4 simple steps</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold">1</div>
                <h4 className="font-semibold text-slate-900">Enter Request</h4>
                <p className="text-sm text-slate-600">Describe the report you want to create</p>
              </div>

              <div className="flex flex-col items-center text-center space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold">2</div>
                <h4 className="font-semibold text-slate-900">Select Source</h4>
                <p className="text-sm text-slate-600">Choose a data source for your report</p>
              </div>

              <div className="flex flex-col items-center text-center space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold">3</div>
                <h4 className="font-semibold text-slate-900">Preview SQL</h4>
                <p className="text-sm text-slate-600">Review the generated SQL query</p>
              </div>

              <div className="flex flex-col items-center text-center space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold">4</div>
                <h4 className="font-semibold text-slate-900">Publish</h4>
                <p className="text-sm text-slate-600">Get a shareable render link</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
