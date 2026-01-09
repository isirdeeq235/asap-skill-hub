import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, CreditCard, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

interface IDCardGeneratorProps {
  userId: string;
  profile: {
    full_name: string;
    matric_number: string;
    department: string;
    email: string;
    application_status: string;
  };
  skillForm: {
    skill_choice: string;
    level: string;
    photo_url: string | null;
  } | null;
  existingIdCard: {
    card_url: string;
    generated_at: string;
  } | null;
  onIdGenerated: () => void;
}

const IDCardGenerator = ({ 
  userId, 
  profile, 
  skillForm, 
  existingIdCard,
  onIdGenerated 
}: IDCardGeneratorProps) => {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const canGenerateId = 
    profile.application_status === 'form_verified' && 
    skillForm && 
    !existingIdCard;

  const generateIdCard = async () => {
    if (!skillForm) return;
    
    setGenerating(true);
    try {
      // Create ID card PDF
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [85.6, 53.98], // Standard ID card size
      });

      // Background
      doc.setFillColor(41, 128, 185);
      doc.rect(0, 0, 85.6, 15, 'F');

      // Header
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.text('ATAP SKILLS CENTER', 42.8, 6, { align: 'center' });
      doc.setFontSize(6);
      doc.setFont(undefined, 'normal');
      doc.text('Student Identification Card', 42.8, 11, { align: 'center' });

      // Reset colors
      doc.setTextColor(44, 62, 80);

      // Photo placeholder area
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(240, 240, 240);
      doc.rect(5, 18, 20, 25, 'FD');
      doc.setFontSize(5);
      doc.text('PHOTO', 15, 32, { align: 'center' });

      // Student info
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      doc.text(profile.full_name.toUpperCase(), 30, 22);
      
      doc.setFontSize(5);
      doc.setFont(undefined, 'normal');
      
      doc.text(`Matric No: ${profile.matric_number}`, 30, 27);
      doc.text(`Department: ${profile.department}`, 30, 31);
      doc.text(`Skill: ${skillForm.skill_choice}`, 30, 35);
      doc.text(`Level: ${skillForm.level}`, 30, 39);

      // Footer
      doc.setFillColor(41, 128, 185);
      doc.rect(0, 48, 85.6, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(4);
      doc.text(`ID: ${userId.slice(0, 8).toUpperCase()}`, 5, 52);
      doc.text(`Issued: ${new Date().toLocaleDateString()}`, 80, 52, { align: 'right' });

      // Convert to blob
      const pdfBlob = doc.output('blob');
      const fileName = `${userId}/id-card-${Date.now()}.pdf`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('passport-photos')
        .upload(fileName, pdfBlob, { contentType: 'application/pdf' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('passport-photos')
        .getPublicUrl(fileName);

      // Save ID card record
      const { error: insertError } = await supabase
        .from('id_cards')
        .insert({
          user_id: userId,
          card_url: publicUrl,
          generated_by: 'student',
        });

      if (insertError) throw insertError;

      // Update application status
      await supabase
        .from('profiles')
        .update({ application_status: 'id_generated' })
        .eq('user_id', userId);

      toast({
        title: 'ID Card Generated!',
        description: 'Your student ID card has been created successfully.',
      });

      // Download the PDF
      doc.save(`ATAP-ID-${profile.matric_number}.pdf`);

      onIdGenerated();
    } catch (error: any) {
      console.error('Error generating ID card:', error);
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate ID card',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const downloadExistingCard = async () => {
    if (!existingIdCard) return;
    
    window.open(existingIdCard.card_url, '_blank');
  };

  if (profile.application_status === 'form_submitted') {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Student ID Card
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Badge variant="secondary" className="mb-4">Pending Verification</Badge>
            <p className="text-muted-foreground">
              Your form is awaiting admin verification. Once verified, you can generate your ID card.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (profile.application_status === 'form_rejected') {
    return (
      <Card className="shadow-card border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <CreditCard className="h-5 w-5" />
            Student ID Card
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Badge variant="destructive" className="mb-4">Form Rejected</Badge>
            <p className="text-muted-foreground">
              Your form was rejected. Please contact admin for more information.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (existingIdCard || profile.application_status === 'id_generated') {
    return (
      <Card className="shadow-card border-success">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            Student ID Card
          </CardTitle>
          <CardDescription>
            Generated on {existingIdCard ? new Date(existingIdCard.generated_at).toLocaleDateString() : 'N/A'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center py-4">
              <Badge className="bg-success mb-4">ID Card Generated</Badge>
              <p className="text-muted-foreground mb-4">
                Your student ID card has been generated. You can download it anytime.
              </p>
            </div>
            {existingIdCard && (
              <Button onClick={downloadExistingCard} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Download ID Card
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (canGenerateId) {
    return (
      <Card className="shadow-card border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Generate Student ID Card
          </CardTitle>
          <CardDescription>
            Your form has been verified! You can now generate your ID card.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <p><strong>Name:</strong> {profile.full_name}</p>
              <p><strong>Matric No:</strong> {profile.matric_number}</p>
              <p><strong>Department:</strong> {profile.department}</p>
              <p><strong>Skill:</strong> {skillForm?.skill_choice}</p>
            </div>
            <Button 
              onClick={generateIdCard} 
              className="w-full" 
              disabled={generating}
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Generate & Download ID Card
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              This action can only be done once. Your ID card will be saved permanently.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default IDCardGenerator;