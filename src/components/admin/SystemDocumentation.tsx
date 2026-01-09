import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download, Database, Users, Shield, Zap, GitBranch, Settings } from "lucide-react";
import { generateSystemDocumentation } from "@/utils/generateSystemPdf";
import { toast } from "sonner";

const SystemDocumentation = () => {
  const handleDownload = () => {
    try {
      generateSystemDocumentation();
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    }
  };

  const sections = [
    {
      icon: GitBranch,
      title: "System Architecture",
      description: "Technology stack, route structure, and component organization"
    },
    {
      icon: Users,
      title: "Role Hierarchy",
      description: "Super Admin, Admin, Moderator, and Student permissions"
    },
    {
      icon: Database,
      title: "Database Schema",
      description: "Tables, relationships, and data structure overview"
    },
    {
      icon: FileText,
      title: "User Flows",
      description: "Registration, payment, form submission, and edit request flows"
    },
    {
      icon: Settings,
      title: "Features Breakdown",
      description: "Public pages, student portal, admin, and super admin features"
    },
    {
      icon: Shield,
      title: "Security Features",
      description: "RLS policies, RBAC, payment security, and rate limiting"
    },
    {
      icon: Zap,
      title: "Edge Functions",
      description: "Payment processing, webhooks, and background tasks"
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                System Documentation
              </CardTitle>
              <CardDescription>
                Complete technical documentation of the ATAP Skills Center system
              </CardDescription>
            </div>
            <Button onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sections.map((section, index) => (
              <Card key={index} className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <section.icon className="h-4 w-4 text-primary" />
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {section.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">PDF Contents:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Cover page with table of contents</li>
              <li>• System architecture and technology stack</li>
              <li>• Complete role hierarchy with permissions</li>
              <li>• Full database schema documentation</li>
              <li>• User flow diagrams and processes</li>
              <li>• Features breakdown by user type</li>
              <li>• Security implementation details</li>
              <li>• Edge functions reference</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemDocumentation;
