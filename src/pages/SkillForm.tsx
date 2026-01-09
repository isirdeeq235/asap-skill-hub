import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, ArrowLeft } from "lucide-react";
import { z } from "zod";

const formSchema = z.object({
  level: z.string().min(1, "Level is required"),
  skillChoice: z.string().min(1, "Skill choice is required"),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  additionalInfo: z.string().optional(),
});

const SKILL_OPTIONS = [
  "Web Development",
  "Mobile App Development",
  "Graphic Design",
  "Digital Marketing",
  "Data Analysis",
  "Video Editing",
  "Photography",
  "Content Writing",
  "UI/UX Design",
  "Computer Hardware",
  "Fashion Design",
  "Event Planning",
];

const SkillForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  const [formData, setFormData] = useState({
    level: "",
    skillChoice: "",
    reason: "",
    additionalInfo: "",
  });

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/student/auth");
        return;
      }

      setUserId(user.id);

      // Check if form submissions are open
      const { data: formLockSetting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "form_submissions_open")
        .single();

      if (formLockSetting && formLockSetting.value === "false") {
        toast({
          title: "Form Submissions Closed",
          description: "New form submissions are currently not being accepted. Please check back later.",
          variant: "destructive",
        });
        navigate("/student/dashboard");
        return;
      }

      // Check payment status - get the latest payment
      const { data: payment } = await supabase
        .from("payments")
        .select("status")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!payment || payment.status !== "success") {
        toast({
          title: "Payment Required",
          description: "Please complete payment before accessing the form",
          variant: "destructive",
        });
        navigate("/student/dashboard");
        return;
      }

      // Check if form already submitted
      const { data: existingForm } = await supabase
        .from("skill_forms")
        .select("id")
        .eq("student_id", user.id)
        .maybeSingle();

      if (existingForm) {
        toast({
          title: "Form Already Submitted",
          description: "You have already submitted your skill acquisition form",
        });
        navigate("/student/dashboard");
      }
    } catch (error) {
      console.error("Error checking access:", error);
      navigate("/student/dashboard");
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Photo must be less than 5MB",
          variant: "destructive",
        });
        return;
      }

      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile || !userId) return null;

    setUploadingPhoto(true);
    try {
      const fileExt = photoFile.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from("passport-photos")
        .upload(fileName, photoFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("passport-photos")
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error: any) {
      console.error("Error uploading photo:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload photo",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form
      formSchema.parse(formData);

      if (!photoFile) {
        toast({
          title: "Photo Required",
          description: "Please upload your passport photograph",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Upload photo
      const photoUrl = await uploadPhoto();
      if (!photoUrl) {
        setLoading(false);
        return;
      }

      // Submit form - check for existing submission first
      const { data: existingForm } = await supabase
        .from("skill_forms")
        .select("id")
        .eq("student_id", userId)
        .maybeSingle();

      if (existingForm) {
        toast({
          title: "Form Already Submitted",
          description: "You have already submitted your skill acquisition form. Redirecting to dashboard...",
          variant: "destructive",
        });
        navigate("/student/dashboard");
        return;
      }

      const { error } = await supabase.from("skill_forms").insert({
        student_id: userId,
        level: formData.level,
        skill_choice: formData.skillChoice,
        reason: formData.reason,
        additional_info: formData.additionalInfo || null,
        photo_url: photoUrl,
      });

      if (error) {
        // Handle duplicate key error specifically
        if (error.code === "23505") {
          toast({
            title: "Form Already Submitted",
            description: "You have already submitted your skill acquisition form",
            variant: "destructive",
          });
          navigate("/student/dashboard");
          return;
        }
        throw error;
      }

      // Update application_status to 'form_submitted'
      await supabase
        .from("profiles")
        .update({ application_status: "form_submitted" })
        .eq("user_id", userId);

      toast({
        title: "Form submitted successfully!",
        description: "Your skill acquisition registration is complete",
      });

      navigate("/student/dashboard");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Submission failed",
          description: error.message || "An error occurred",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/student/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Skill Acquisition Form</CardTitle>
            <CardDescription>Complete your registration for the skill acquisition program</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="level">Level</Label>
                <Select
                  value={formData.level}
                  onValueChange={(value) => setFormData({ ...formData, level: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ND1">ND1</SelectItem>
                    <SelectItem value="ND2">ND2</SelectItem>
                    <SelectItem value="HND1">HND1</SelectItem>
                    <SelectItem value="HND2">HND2</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="skillChoice">Preferred Skill</Label>
                <Select
                  value={formData.skillChoice}
                  onValueChange={(value) => setFormData({ ...formData, skillChoice: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your preferred skill" />
                  </SelectTrigger>
                  <SelectContent>
                    {SKILL_OPTIONS.map((skill) => (
                      <SelectItem key={skill} value={skill}>
                        {skill}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Choosing This Skill</Label>
                <Textarea
                  id="reason"
                  placeholder="Explain why you chose this skill..."
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="additionalInfo">Additional Information (Optional)</Label>
                <Textarea
                  id="additionalInfo"
                  placeholder="Any other information you'd like to share..."
                  value={formData.additionalInfo}
                  onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="photo">Passport Photograph</Label>
                <div className="flex flex-col gap-4">
                  <Input
                    id="photo"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    required
                  />
                  {photoPreview && (
                    <div className="flex justify-center">
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="h-48 w-48 object-cover rounded-lg border-2 border-border"
                      />
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload a clear passport-sized photograph (Max 5MB)
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading || uploadingPhoto}>
                {(loading || uploadingPhoto) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {uploadingPhoto ? "Uploading Photo..." : "Submit Form"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SkillForm;
