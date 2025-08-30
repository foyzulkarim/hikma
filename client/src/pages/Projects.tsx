import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { 
  Plus, 
  Search, 
  GitBranch, 
  FileText, 
  Calendar, 
  MoreHorizontal,
  RefreshCw,
  Edit,
  Trash2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Projects = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const projects = [
    {
      id: "1",
      name: "React Application",
      description: "Frontend React app with TypeScript and modern tooling",
      repositoryUrl: "https://github.com/company/react-app",
      lastSync: "2 minutes ago",
      syncStatus: "active" as const,
      fileCount: 247,
      totalSize: "12.3 MB",
    },
    {
      id: "2", 
      name: "API Server",
      description: "Node.js REST API with Express and PostgreSQL",
      repositoryUrl: "https://github.com/company/api-server",
      lastSync: "1 hour ago", 
      syncStatus: "syncing" as const,
      fileCount: 186,
      totalSize: "8.7 MB",
    },
    {
      id: "3",
      name: "ML Pipeline",
      description: "Python machine learning pipeline with TensorFlow",
      repositoryUrl: "https://github.com/company/ml-pipeline",
      lastSync: "3 hours ago",
      syncStatus: "error" as const,
      fileCount: 94,
      totalSize: "45.2 MB",
    },
  ];

  const getSyncStatusConfig = (status: string) => {
    switch (status) {
      case "active":
        return { indicator: "online" as const, text: "Synced", variant: "default" as const };
      case "syncing":
        return { indicator: "warning" as const, text: "Syncing", variant: "secondary" as const };
      case "error":
        return { indicator: "error" as const, text: "Error", variant: "destructive" as const };
      default:
        return { indicator: "offline" as const, text: "Offline", variant: "secondary" as const };
    }
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage your code repositories and sync status
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredProjects.map((project) => {
          const statusConfig = getSyncStatusConfig(project.syncStatus);
          
          return (
            <Card key={project.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {project.description}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Project
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Force Sync
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Repository Info */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <GitBranch className="h-4 w-4" />
                  <span className="truncate">{project.repositoryUrl}</span>
                </div>

                {/* Sync Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusIndicator status={statusConfig.indicator} />
                    <span className="text-sm font-medium">{statusConfig.text}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{project.lastSync}</span>
                </div>

                {/* Project Stats */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    <span>{project.fileCount} files</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {project.totalSize}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    View Details
                  </Button>
                  <Button variant="default" size="sm" className="flex-1">
                    Query Project
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredProjects.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "Try adjusting your search terms" : "Get started by creating your first project"}
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};