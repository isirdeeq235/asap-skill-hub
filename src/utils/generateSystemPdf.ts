import jsPDF from 'jspdf';

export const generateSystemDocumentation = () => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  const addHeader = (text: string, size: number = 16) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', 'bold');
    doc.text(text, margin, yPosition);
    yPosition += size * 0.5;
  };

  const addText = (text: string, size: number = 11) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, margin, yPosition);
    yPosition += lines.length * size * 0.4;
  };

  const addBullet = (text: string) => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(`• ${text}`, contentWidth - 10);
    doc.text(lines, margin + 5, yPosition);
    yPosition += lines.length * 5;
  };

  const addNewPage = () => {
    doc.addPage();
    yPosition = margin;
  };

  const checkPageBreak = (requiredSpace: number = 40) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      addNewPage();
    }
  };

  const addFooter = (pageNum: number) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text('ATAP Skills Center - System Documentation', margin, pageHeight - 10);
  };

  // ========== COVER PAGE ==========
  doc.setFillColor(34, 139, 34);
  doc.rect(0, 0, pageWidth, 60, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('ATAP SKILLS CENTER', pageWidth / 2, 35, { align: 'center' });
  
  doc.setTextColor(0, 0, 0);
  yPosition = 80;
  
  doc.setFontSize(22);
  doc.text('System Documentation', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 20;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;
  doc.text('Version 1.0', pageWidth / 2, yPosition, { align: 'center' });
  
  yPosition = 130;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Table of Contents', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;
  
  const tocItems = [
    '1. System Architecture',
    '2. Role Hierarchy',
    '3. Database Schema',
    '4. User Flows',
    '5. Features Breakdown',
    '6. Security Features',
    '7. Edge Functions'
  ];
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  tocItems.forEach(item => {
    doc.text(item, pageWidth / 2 - 40, yPosition);
    yPosition += 8;
  });
  
  addFooter(1);

  // ========== PAGE 2: SYSTEM ARCHITECTURE ==========
  addNewPage();
  addHeader('1. SYSTEM ARCHITECTURE', 18);
  yPosition += 10;
  
  addHeader('Technology Stack', 14);
  yPosition += 5;
  addBullet('Frontend: React 18 + TypeScript + Vite');
  addBullet('Styling: Tailwind CSS + shadcn/ui components');
  addBullet('Backend: Supabase (Database, Auth, Edge Functions)');
  addBullet('Payment: Paystack Integration');
  addBullet('State Management: TanStack Query');
  addBullet('Routing: React Router v6');
  yPosition += 10;
  
  addHeader('Route Structure', 14);
  yPosition += 5;
  
  addText('PUBLIC ROUTES:');
  yPosition += 3;
  addBullet('/ - Landing page');
  addBullet('/student-auth - Student login/signup');
  addBullet('/admin-auth - Admin/Staff login');
  addBullet('/reset-password - Password reset request');
  addBullet('/update-password - Password update');
  yPosition += 5;
  
  addText('STUDENT ROUTES (Protected):');
  yPosition += 3;
  addBullet('/student-dashboard - Student main dashboard');
  addBullet('/student-profile - View/edit profile');
  addBullet('/payment - Payment processing');
  addBullet('/verify-payment - Payment verification');
  addBullet('/skill-form - Submit skill form');
  addBullet('/edit-skill-form - Edit submitted form');
  yPosition += 5;
  
  addText('ADMIN ROUTES (Protected):');
  yPosition += 3;
  addBullet('/admin-dashboard - Admin dashboard');
  addBullet('/admin-forms - View/verify forms');
  addBullet('/admin-payments - View/verify payments');
  addBullet('/super-admin - Super Admin dashboard');
  
  addFooter(2);

  // ========== PAGE 3: ROLE HIERARCHY ==========
  addNewPage();
  addHeader('2. ROLE HIERARCHY', 18);
  yPosition += 10;
  
  addHeader('Super Admin (Level 4)', 14);
  yPosition += 3;
  addText('Full system access with complete control over all features.');
  yPosition += 3;
  addBullet('Manage all users and assign any role');
  addBullet('Delete any user account');
  addBullet('View/edit/delete all skill forms');
  addBullet('View/verify/delete all payments');
  addBullet('Configure app settings (fees, form submissions)');
  addBullet('Access system documentation');
  yPosition += 8;
  
  addHeader('Admin (Level 3)', 14);
  yPosition += 3;
  addText('Administrative access for day-to-day operations.');
  yPosition += 3;
  addBullet('View all submitted forms');
  addBullet('Verify/reject student forms');
  addBullet('View payment records');
  addBullet('Verify payment status');
  addBullet('Cannot manage other admins or super admins');
  yPosition += 8;
  
  addHeader('Moderator (Level 2)', 14);
  yPosition += 3;
  addText('Limited access for monitoring purposes.');
  yPosition += 3;
  addBullet('Read-only access to forms');
  addBullet('Read-only access to payments');
  addBullet('Cannot modify any data');
  yPosition += 8;
  
  addHeader('Student (Level 1)', 14);
  yPosition += 3;
  addText('Standard user access for students.');
  yPosition += 3;
  addBullet('Register and manage own profile');
  addBullet('Make payments for registration');
  addBullet('Submit skill acquisition form');
  addBullet('Request form edits after submission');
  addBullet('View own payment history');
  
  addFooter(3);

  // ========== PAGE 4: DATABASE SCHEMA ==========
  addNewPage();
  addHeader('3. DATABASE SCHEMA', 18);
  yPosition += 10;
  
  addHeader('profiles', 14);
  yPosition += 3;
  addText('Stores user profile information linked to auth.users');
  addBullet('id (UUID) - Primary key');
  addBullet('user_id (UUID) - References auth.users');
  addBullet('full_name (TEXT) - User full name');
  addBullet('email (TEXT) - User email address');
  addBullet('phone (TEXT) - Phone number');
  addBullet('matric_number (TEXT) - Student matric number');
  addBullet('department (TEXT) - Academic department');
  addBullet('level (TEXT) - Academic level');
  addBullet('created_at, updated_at (TIMESTAMP)');
  yPosition += 8;
  
  addHeader('user_roles', 14);
  yPosition += 3;
  addText('Maps users to their assigned roles');
  addBullet('id (UUID) - Primary key');
  addBullet('user_id (UUID) - References auth.users');
  addBullet('role (app_role) - ENUM: super_admin, admin, moderator, student');
  addBullet('created_at (TIMESTAMP)');
  yPosition += 8;
  
  addHeader('payments', 14);
  yPosition += 3;
  addText('Tracks all payment transactions');
  addBullet('id (UUID) - Primary key');
  addBullet('user_id (UUID) - User who made payment');
  addBullet('reference (TEXT) - Paystack reference');
  addBullet('amount (INTEGER) - Amount in kobo');
  addBullet('status (TEXT) - pending, success, failed');
  addBullet('paid_at (TIMESTAMP) - When payment succeeded');
  addBullet('verified_by, verified_at - Admin verification');
  
  addFooter(4);

  // ========== PAGE 5: DATABASE SCHEMA (continued) ==========
  addNewPage();
  addHeader('3. DATABASE SCHEMA (continued)', 18);
  yPosition += 10;
  
  addHeader('skill_forms', 14);
  yPosition += 3;
  addText('Stores student skill acquisition form submissions');
  addBullet('id (UUID) - Primary key');
  addBullet('user_id (UUID) - Student who submitted');
  addBullet('skill_choice (TEXT) - Selected skill');
  addBullet('level (TEXT) - Academic level');
  addBullet('reason (TEXT) - Reason for skill choice');
  addBullet('passport_url (TEXT) - Uploaded passport photo');
  addBullet('is_submitted (BOOLEAN) - Submission status');
  addBullet('status (TEXT) - pending, verified, rejected');
  addBullet('verified_by, verified_at - Admin verification');
  yPosition += 8;
  
  addHeader('edit_requests', 14);
  yPosition += 3;
  addText('Manages student requests to edit submitted forms');
  addBullet('id (UUID) - Primary key');
  addBullet('user_id (UUID) - Student requesting edit');
  addBullet('reason (TEXT) - Reason for edit request');
  addBullet('status (TEXT) - pending, approved, denied');
  addBullet('used (BOOLEAN) - Whether edit was used');
  addBullet('approved_by (UUID) - Admin who approved');
  yPosition += 8;
  
  addHeader('app_settings', 14);
  yPosition += 3;
  addText('Application-wide configuration settings');
  addBullet('id (UUID) - Primary key');
  addBullet('key (TEXT) - Setting identifier (unique)');
  addBullet('value (TEXT) - Setting value');
  addBullet('description (TEXT) - Human-readable description');
  yPosition += 8;
  
  addHeader('feedback', 14);
  yPosition += 3;
  addText('User feedback and contact form submissions');
  addBullet('id (UUID) - Primary key');
  addBullet('name, email (TEXT) - Submitter info');
  addBullet('type (TEXT) - Feedback type');
  addBullet('message (TEXT) - Feedback content');
  addBullet('status (TEXT) - new, reviewed, resolved');
  
  addFooter(5);

  // ========== PAGE 6: USER FLOWS ==========
  addNewPage();
  addHeader('4. USER FLOWS', 18);
  yPosition += 10;
  
  addHeader('Student Registration Flow', 14);
  yPosition += 3;
  addText('1. Student visits /student-auth');
  addText('2. Fills signup form (name, email, password, matric, dept, phone)');
  addText('3. System creates auth.users entry');
  addText('4. Trigger creates profile and assigns student role');
  addText('5. Student redirected to dashboard');
  yPosition += 8;
  
  addHeader('Payment Flow', 14);
  yPosition += 3;
  addText('1. Student clicks "Make Payment" on dashboard');
  addText('2. System calls initialize-payment edge function');
  addText('3. Paystack checkout page opens');
  addText('4. Student completes payment');
  addText('5. Paystack webhook updates payment status');
  addText('6. Student redirected to verify-payment page');
  addText('7. verify-payment-status confirms transaction');
  yPosition += 8;
  
  addHeader('Skill Form Submission Flow', 14);
  yPosition += 3;
  addText('1. Student accesses skill form (requires successful payment)');
  addText('2. Uploads passport photo');
  addText('3. Selects skill choice from available options');
  addText('4. Provides reason for selection');
  addText('5. Submits form');
  addText('6. Form status set to pending');
  addText('7. Admin reviews and verifies/rejects');
  yPosition += 8;
  
  addHeader('Edit Request Flow', 14);
  yPosition += 3;
  addText('1. Student requests edit from dashboard');
  addText('2. Provides reason for edit');
  addText('3. Admin reviews request');
  addText('4. If approved, student can edit form once');
  addText('5. Edit permission marked as used after submission');
  
  addFooter(6);

  // ========== PAGE 7: FEATURES BREAKDOWN ==========
  addNewPage();
  addHeader('5. FEATURES BREAKDOWN', 18);
  yPosition += 10;
  
  addHeader('Public Pages', 14);
  yPosition += 3;
  addBullet('Landing page with institution info and contact');
  addBullet('Student authentication (login/signup)');
  addBullet('Admin authentication portal');
  addBullet('Password reset functionality');
  addBullet('Contact/feedback form');
  yPosition += 8;
  
  addHeader('Student Portal', 14);
  yPosition += 3;
  addBullet('Dashboard with payment and form status');
  addBullet('Profile management');
  addBullet('Payment processing via Paystack');
  addBullet('Skill form submission with passport upload');
  addBullet('Form edit requests');
  addBullet('Status tracking for payments and forms');
  yPosition += 8;
  
  addHeader('Admin Dashboard', 14);
  yPosition += 3;
  addBullet('Overview statistics (forms, payments, users)');
  addBullet('Form verification with search and filters');
  addBullet('Payment verification and status updates');
  addBullet('Student form previews');
  yPosition += 8;
  
  addHeader('Super Admin Dashboard', 14);
  yPosition += 3;
  addBullet('Complete system statistics');
  addBullet('User Management: Create, edit roles, delete users');
  addBullet('Content Management: View/edit/delete all forms');
  addBullet('Transaction Management: Full payment control');
  addBullet('Settings Management: Configure fees, toggle submissions');
  addBullet('System documentation export');
  
  addFooter(7);

  // ========== PAGE 8: SECURITY FEATURES ==========
  addNewPage();
  addHeader('6. SECURITY FEATURES', 18);
  yPosition += 10;
  
  addHeader('Row-Level Security (RLS)', 14);
  yPosition += 3;
  addText('All database tables have RLS enabled with policies that:');
  yPosition += 3;
  addBullet('Restrict students to their own data');
  addBullet('Allow admins read access to all records');
  addBullet('Super admins have full CRUD on all tables');
  addBullet('Prevent unauthorized data access at database level');
  yPosition += 8;
  
  addHeader('Role-Based Access Control', 14);
  yPosition += 3;
  addText('Hierarchical role system with database functions:');
  yPosition += 3;
  addBullet('get_role_level() - Returns numeric level for role');
  addBullet('has_role() - Checks if user has specific role');
  addBullet('has_role_or_higher() - Checks role hierarchy');
  addBullet('get_user_highest_role() - Gets user primary role');
  yPosition += 8;
  
  addHeader('Payment Security', 14);
  yPosition += 3;
  addBullet('Paystack integration with server-side verification');
  addBullet('SHA-512 HMAC webhook signature validation');
  addBullet('Reference uniqueness enforcement');
  addBullet('Amount verification against expected values');
  yPosition += 8;
  
  addHeader('Authentication Security', 14);
  yPosition += 3;
  addBullet('Supabase Auth with secure session management');
  addBullet('Protected routes with auth checks');
  addBullet('Automatic session refresh');
  addBullet('Secure password reset flow via email');
  yPosition += 8;
  
  addHeader('Rate Limiting', 14);
  yPosition += 3;
  addBullet('Rate limits table tracks request frequency');
  addBullet('Automatic cleanup of old rate limit records');
  addBullet('Prevents abuse of sensitive endpoints');
  
  addFooter(8);

  // ========== PAGE 9: EDGE FUNCTIONS ==========
  addNewPage();
  addHeader('7. EDGE FUNCTIONS', 18);
  yPosition += 10;
  
  addHeader('initialize-payment', 14);
  yPosition += 3;
  addText('Initializes Paystack payment transaction');
  addBullet('Validates user authentication');
  addBullet('Creates payment record in database');
  addBullet('Calls Paystack API to initialize transaction');
  addBullet('Returns authorization URL for checkout');
  yPosition += 8;
  
  addHeader('verify-payment-status', 14);
  yPosition += 3;
  addText('Verifies payment status with Paystack');
  addBullet('Takes payment reference as input');
  addBullet('Queries Paystack API for transaction status');
  addBullet('Updates local payment record');
  addBullet('Returns verification result');
  yPosition += 8;
  
  addHeader('payment-webhook', 14);
  yPosition += 3;
  addText('Handles Paystack webhook notifications');
  addBullet('Validates webhook signature (SHA-512 HMAC)');
  addBullet('Processes charge.success events');
  addBullet('Updates payment status in real-time');
  addBullet('Idempotent processing prevents duplicates');
  yPosition += 8;
  
  addHeader('cleanup-old-payments', 14);
  yPosition += 3;
  addText('Scheduled cleanup of stale payment records');
  addBullet('Removes pending payments older than threshold');
  addBullet('Cleans up rate limit records');
  addBullet('Maintains database hygiene');
  yPosition += 8;
  
  addHeader('send-password-change-email', 14);
  yPosition += 3;
  addText('Sends password reset emails');
  addBullet('Uses Resend API for email delivery');
  addBullet('Generates secure reset links');
  addBullet('Rate limited to prevent abuse');
  
  addFooter(9);

  // Save the PDF
  doc.save('ATAP-System-Documentation.pdf');
};
