import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { 
  Database, 
  MessageSquare, 
  Clock, 
  TrendingUp, 
  RefreshCw,
  Play,
  Eye
} from "lucide-react";

export const Dashboard = () => {
  const systemServices = [
    { name: "Knowledge Service", status: "online" as const, uptime: "99.9%" },
    { name: "Agent Service", status: "online" as const, uptime: "99.8%" },
    { name: "PostgreSQL", status: "online" as const, uptime: "100%" },
    { name: "Redis Cache", status: "warning" as const, uptime: "99.2%" },
    { name: "Neo4j Graph", status: "online" as const, uptime: "99.7%" },
  ];

  const recentQueries = [
    {
      id: "1",
      query: "Explain the authentication flow in the user service",
      timestamp: "2 minutes ago",
      confidence: 0.95,
      project: "React Application",
    },
    {
      id: "2", 
      query: "Find all functions that handle file uploads",
      timestamp: "15 minutes ago",
      confidence: 0.87,
      project: "API Server",
    },
    {
      id: "3",
      query: "How does the caching layer work in this system?",
      timestamp: "1 hour ago",
      confidence: 0.92,
      project: "ML Pipeline",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your AI code intelligence platform
          </p>
        </div>
        <Button variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Queries</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,247</div>
            <p className="text-xs text-muted-foreground">
              +12% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.2s</div>
            <p className="text-xs text-muted-foreground">
              -5ms from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98.7%</div>
            <p className="text-xs text-muted-foreground">
              +0.2% from last hour
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">
              All synced and ready
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>
              Status of all backend services
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {systemServices.map((service) => (
              <div key={service.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusIndicator status={service.status} />
                  <span className="font-medium">{service.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={service.status === "online" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {service.uptime} uptime
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Queries</CardTitle>
            <CardDescription>
              Latest AI interactions and responses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentQueries.map((query) => (
              <div key={query.id} className="space-y-2">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium leading-relaxed">
                    {query.query}
                  </p>
                  <Badge variant="outline" className="ml-2 flex-shrink-0">
                    {Math.round(query.confidence * 100)}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>{query.project}</span>
                    <span>•</span>
                    <span>{query.timestamp}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Play className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};