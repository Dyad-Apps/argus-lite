import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface CreateUserWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated?: () => void;
  organizationId: string;
  groups?: { id: string; name: string }[];
  roles?: { id: string; name: string }[];
}

interface UserFormData {
  // Step 1: Basic Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  sendInvitation: boolean;
  // Step 2: Credentials
  employeeId: string;
  accessPin: string;
  rfidCard: string;
  badgeCode: string;
  // Step 3: Access Control
  primaryRole: string;
  accountExpiration: 'never' | 'date';
  expirationDate: string;
  groupIds: string[];
}

const initialFormData: UserFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  sendInvitation: true,
  employeeId: '',
  accessPin: '',
  rfidCard: '',
  badgeCode: '',
  primaryRole: '',
  accountExpiration: 'never',
  expirationDate: '',
  groupIds: [],
};

const steps = [
  { id: 1, title: 'Basic Information', description: 'User details and contact info' },
  { id: 2, title: 'Credentials', description: 'Access credentials and IDs' },
  { id: 3, title: 'Access Control', description: 'Role and group assignment' },
];

export function CreateUserWizard({
  open,
  onOpenChange,
  onUserCreated,
  organizationId,
  groups = [],
  roles = [],
}: CreateUserWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<UserFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof UserFormData, string>>>({});

  const updateFormData = <K extends keyof UserFormData>(field: K, value: UserFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof UserFormData, string>> = {};

    if (step === 1) {
      if (!formData.firstName.trim()) {
        newErrors.firstName = 'First name is required';
      }
      if (!formData.lastName.trim()) {
        newErrors.lastName = 'Last name is required';
      }
      if (!formData.email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Invalid email format';
      }
    }

    if (step === 2) {
      if (formData.accessPin && (formData.accessPin.length < 4 || formData.accessPin.length > 8)) {
        newErrors.accessPin = 'PIN must be 4-8 digits';
      }
      if (formData.accessPin && !/^\d+$/.test(formData.accessPin)) {
        newErrors.accessPin = 'PIN must contain only digits';
      }
    }

    if (step === 3) {
      if (formData.accountExpiration === 'date' && !formData.expirationDate) {
        newErrors.expirationDate = 'Expiration date is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);
    try {
      await apiClient.post('/users', {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone || undefined,
        organizationId,
        sendInvitation: formData.sendInvitation,
        metadata: {
          employeeId: formData.employeeId || undefined,
          accessPin: formData.accessPin || undefined,
          rfidCard: formData.rfidCard || undefined,
          badgeCode: formData.badgeCode || undefined,
        },
        roleId: formData.primaryRole || undefined,
        groupIds: formData.groupIds.length > 0 ? formData.groupIds : undefined,
        expiresAt: formData.accountExpiration === 'date' ? formData.expirationDate : undefined,
      });

      onUserCreated?.();
      handleClose();
    } catch (err) {
      console.error('Failed to create user:', err);
      setErrors({ email: 'Failed to create user. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setFormData(initialFormData);
    setErrors({});
    onOpenChange(false);
  };

  const progress = ((currentStep - 1) / (steps.length - 1)) * 100;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Complete the wizard to add a new user to your organization.
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="space-y-4">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between">
            {steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  'flex flex-col items-center gap-1 text-xs',
                  currentStep >= step.id ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium',
                    currentStep > step.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : currentStep === step.id
                        ? 'border-primary text-primary'
                        : 'border-muted-foreground text-muted-foreground'
                  )}
                >
                  {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <span className="font-medium">{step.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="py-4">
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => updateFormData('firstName', e.target.value)}
                    placeholder="Enter first name"
                  />
                  {errors.firstName && (
                    <p className="text-sm text-destructive">{errors.firstName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => updateFormData('lastName', e.target.value)}
                    placeholder="Enter last name"
                  />
                  {errors.lastName && (
                    <p className="text-sm text-destructive">{errors.lastName}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData('email', e.target.value)}
                  placeholder="user@example.com"
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateFormData('phone', e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sendInvitation"
                  checked={formData.sendInvitation}
                  onCheckedChange={(checked) =>
                    updateFormData('sendInvitation', checked as boolean)
                  }
                />
                <Label htmlFor="sendInvitation" className="text-sm font-normal">
                  Send invitation email to user
                </Label>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee ID</Label>
                <Input
                  id="employeeId"
                  value={formData.employeeId}
                  onChange={(e) => updateFormData('employeeId', e.target.value)}
                  placeholder="EMP-001"
                />
                <p className="text-xs text-muted-foreground">
                  Optional employee identifier for HR integration
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accessPin">Access PIN (4-8 digits)</Label>
                <Input
                  id="accessPin"
                  value={formData.accessPin}
                  onChange={(e) => updateFormData('accessPin', e.target.value)}
                  placeholder="1234"
                  maxLength={8}
                />
                {errors.accessPin && (
                  <p className="text-sm text-destructive">{errors.accessPin}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  For keypad or kiosk authentication
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rfidCard">RFID Card Number</Label>
                <Input
                  id="rfidCard"
                  value={formData.rfidCard}
                  onChange={(e) => updateFormData('rfidCard', e.target.value)}
                  placeholder="Enter RFID card number"
                />
                <p className="text-xs text-muted-foreground">
                  For proximity card authentication
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="badgeCode">Badge Code</Label>
                <Input
                  id="badgeCode"
                  value={formData.badgeCode}
                  onChange={(e) => updateFormData('badgeCode', e.target.value)}
                  placeholder="Enter badge code"
                />
                <p className="text-xs text-muted-foreground">
                  For badge scanning systems
                </p>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="primaryRole">Primary Role</Label>
                <Select
                  value={formData.primaryRole}
                  onValueChange={(value) => updateFormData('primaryRole', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.length > 0 ? (
                      roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Account Expiration</Label>
                <RadioGroup
                  value={formData.accountExpiration}
                  onValueChange={(value) =>
                    updateFormData('accountExpiration', value as 'never' | 'date')
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="never" id="never" />
                    <Label htmlFor="never" className="font-normal">
                      Never expires
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="date" id="date" />
                    <Label htmlFor="date" className="font-normal">
                      Set expiration date
                    </Label>
                  </div>
                </RadioGroup>
                {formData.accountExpiration === 'date' && (
                  <div className="ml-6 space-y-2">
                    <Input
                      type="date"
                      value={formData.expirationDate}
                      onChange={(e) => updateFormData('expirationDate', e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                    {errors.expirationDate && (
                      <p className="text-sm text-destructive">{errors.expirationDate}</p>
                    )}
                  </div>
                )}
              </div>

              {groups.length > 0 && (
                <div className="space-y-3">
                  <Label>Assign to Groups</Label>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto rounded-md border p-3">
                    {groups.map((group) => (
                      <div key={group.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`group-${group.id}`}
                          checked={formData.groupIds.includes(group.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              updateFormData('groupIds', [...formData.groupIds, group.id]);
                            } else {
                              updateFormData(
                                'groupIds',
                                formData.groupIds.filter((id) => id !== group.id)
                              );
                            }
                          }}
                        />
                        <Label htmlFor={`group-${group.id}`} className="font-normal">
                          {group.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={currentStep === 1 ? handleClose : handlePrevious}
          >
            {currentStep === 1 ? (
              'Cancel'
            ) : (
              <>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </>
            )}
          </Button>
          {currentStep < 3 ? (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create User'
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
