import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  Sparkles, 
  FileText, 
  Clock, 
  ThumbsUp, 
  ThumbsDown,
  Copy,
  Download
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Query = () => {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    
    // Mock API response
    setTimeout(() => {
      setResponse({
        id: "123",
        response: `Based on the code analysis, this function implements a binary search algorithm with the following characteristics:

\`\`\`typescript
function binarySearch(arr: number[], target: number): number {
  let left = 0;
  let right = arr.length - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    
    if (arr[mid] === target) {
      return mid;
    } else if (arr[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  
  return -1;
}
\`\`\`

**Key Points:**
- Time complexity: O(log n)
- Space complexity: O(1)
- Requires a sorted array as input
- Returns the index of the target element or -1 if not found

The algorithm uses the divide-and-conquer approach to efficiently locate elements in sorted arrays.`,
        confidence: 0.92,
        intent: "code_explanation",
        executionTime: 1240,
        sources: [
          {
            filePath: "src/utils/search.ts",
            relevanceScore: 0.95,
            preview: "function binarySearch(arr: number[], target: number): number..."
          },
          {
            filePath: "tests/search.test.ts", 
            relevanceScore: 0.78,
            preview: "describe('binarySearch', () => { it('should find element in sorted array'..."
          }
        ]
      });
      setIsLoading(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Query Interface</h1>
        <p className="text-muted-foreground">
          Ask questions about your codebase using AI
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Query Input - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Ask Hikma AI
              </CardTitle>
              <CardDescription>
                Describe what you want to understand about your code
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Select defaultValue="react-app">
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="react-app">React Application</SelectItem>
                        <SelectItem value="api-server">API Server</SelectItem>
                        <SelectItem value="ml-pipeline">ML Pipeline</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select defaultValue="general">
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Query type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General Query</SelectItem>
                        <SelectItem value="explanation">Code Explanation</SelectItem>
                        <SelectItem value="search">Code Search</SelectItem>
                        <SelectItem value="documentation">Documentation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Textarea
                    placeholder="e.g., Explain how the authentication system works in this project..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="min-h-24 resize-none"
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    {query.length}/500 characters
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setQuery("")}
                    >
                      Clear
                    </Button>
                    <Button
                      type="submit"
                      disabled={!query.trim() || isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Ask Hikma
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Response */}
          {response && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>AI Response</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {Math.round(response.confidence * 100)}% confidence
                    </Badge>
                    <Badge variant="secondary">
                      {response.executionTime}ms
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="prose max-w-none">
                  <div className="whitespace-pre-wrap font-mono text-sm bg-code-bg border border-code-border rounded-lg p-4">
                    {response.response}
                  </div>
                </div>

                {/* Sources */}
                <div className="space-y-2">
                  <h4 className="font-medium">Sources</h4>
                  <div className="space-y-2">
                    {response.sources.map((source: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium text-sm">{source.filePath}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-md">
                              {source.preview}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline">
                          {Math.round(source.relevanceScore * 100)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm">
                      <ThumbsUp className="h-4 w-4 mr-1" />
                      Helpful
                    </Button>
                    <Button variant="ghost" size="sm">
                      <ThumbsDown className="h-4 w-4 mr-1" />
                      Not helpful
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Query History */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Queries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "How does authentication work?",
                "Find all API endpoints",
                "Explain the database schema"
              ].map((q, index) => (
                <div 
                  key={index}
                  className="p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => setQuery(q)}
                >
                  <p className="text-sm font-medium truncate">{q}</p>
                  <p className="text-xs text-muted-foreground">
                    {index + 1} hour{index > 0 ? 's' : ''} ago
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};