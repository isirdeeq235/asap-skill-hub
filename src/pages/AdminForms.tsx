import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, LogOut, Search, Download, FileText, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FormData {
  id: string;
  student_name: string;
  matric_number: string;
  department: string;
  email: string;
  phone: string;
  skill_choice: string;
  level: string;
  reason: string;
  additional_info: string | null;
  photo_url: string | null;
  submitted_at: string;
}

const AdminForms = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<FormData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/admin/auth");
        return;
      }

      // Check admin role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        toast({
          title: "Access Denied",
          description: "You don't have admin privileges",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/admin/auth");
        return;
      }

      await fetchForms();
    } catch (error) {
      console.error("Error checking admin:", error);
      navigate("/admin/auth");
    } finally {
      setLoading(false);
    }
  };

  const fetchForms = async () => {
    try {
      const { data, error } = await supabase
        .from("skill_forms")
        .select(`
          *,
          profiles:student_id (
            full_name,
            matric_number,
            department,
            email,
            phone
          )
        `)
        .order("submitted_at", { ascending: false });

      if (error) throw error;

      if (data) {
        const formattedData: FormData[] = data.map((form: any) => ({
          id: form.id,
          student_name: form.profiles?.full_name || "N/A",
          matric_number: form.profiles?.matric_number || "N/A",
          department: form.profiles?.department || "N/A",
          email: form.profiles?.email || "N/A",
          phone: form.profiles?.phone || "N/A",
          skill_choice: form.skill_choice,
          level: form.level,
          reason: form.reason,
          additional_info: form.additional_info,
          photo_url: form.photo_url,
          submitted_at: form.submitted_at,
        }));

        setForms(formattedData);
      }
    } catch (error) {
      console.error("Error fetching forms:", error);
      toast({
        title: "Error",
        description: "Failed to fetch skill forms",
        variant: "destructive",
      });
    }
  };

  const exportToCSV = () => {
    if (filteredForms.length === 0) {
      toast({
        title: "No Data",
        description: "No forms to export",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Student Name",
      "Matric Number",
      "Department",
      "Email",
      "Phone",
      "Skill Choice",
      "Level",
      "Reason",
      "Additional Info",
      "Submitted At"
    ];

    const csvContent = [
      headers.join(","),
      ...filteredForms.map(form =>
        [
          `"${form.student_name}"`,
          `"${form.matric_number}"`,
          `"${form.department}"`,
          `"${form.email}"`,
          `"${form.phone}"`,
          `"${form.skill_choice}"`,
          `"${form.level}"`,
          `"${form.reason.replace(/"/g, '""')}"`,
          `"${form.additional_info?.replace(/"/g, '""') || 'N/A'}"`,
          `"${new Date(form.submitted_at).toLocaleString()}"`
        ].join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `skill_forms_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: `Exported ${filteredForms.length} forms to CSV`,
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const filteredForms = forms.filter(
    (form) =>
      form.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      form.matric_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      form.skill_choice.toLowerCase().includes(searchQuery.toLowerCase()) ||
      form.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Submitted Skill Forms</h1>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Card */}
        <Card className="mb-8 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Total Submissions</CardTitle>
              <CardDescription>All skill acquisition forms submitted by students</CardDescription>
            </div>
            <Badge variant="default" className="text-lg px-4 py-2">
              <FileText className="w-4 h-4 mr-2" />
              {forms.length}
            </Badge>
          </CardHeader>
        </Card>

        {/* Forms Table */}
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>All Submitted Forms</CardTitle>
                <CardDescription>View and export student skill forms</CardDescription>
              </div>
              <Button onClick={exportToCSV} disabled={filteredForms.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Export to CSV
              </Button>
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name, matric number, skill, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Matric Number</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Skill Choice</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredForms.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {searchQuery ? "No forms found matching your search" : "No forms submitted yet"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredForms.map((form) => (
                      <TableRow key={form.id}>
                        <TableCell className="font-medium">{form.student_name}</TableCell>
                        <TableCell>{form.matric_number}</TableCell>
                        <TableCell>{form.department}</TableCell>
                        <TableCell>{form.skill_choice}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{form.level}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(form.submitted_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Show detailed view
                              toast({
                                title: form.student_name,
                                description: (
                                  <div className="mt-2 space-y-1 text-sm">
                                    <p><strong>Email:</strong> {form.email}</p>
                                    <p><strong>Phone:</strong> {form.phone}</p>
                                    <p><strong>Skill:</strong> {form.skill_choice}</p>
                                    <p><strong>Level:</strong> {form.level}</p>
                                    <p><strong>Reason:</strong> {form.reason}</p>
                                    {form.additional_info && (
                                      <p><strong>Additional Info:</strong> {form.additional_info}</p>
                                    )}
                                  </div>
                                ),
                              });
                            }}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminForms;
