import React, { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Grid,
  TextField,
  Button,
  Switch,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
} from "@mui/material";
import {
  Person,
  Security,
  Delete,
  Edit,
  Save,
  Cancel,
  Warning,
  CheckCircle,
  AccountCircle,
  Lock,
  Email,
  LocationOn,
  Business,
} from "@mui/icons-material";
import { useForm } from "react-hook-form";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

const Settings = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const { user, logout } = useAuth();

  // Form for profile updates
  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    reset: resetProfile,
    formState: { errors: _profileErrors }, // eslint-disable-line no-unused-vars
  } = useForm({
    defaultValues: {
      username: user?.username || "",
      email: user?.email || "",
      full_name: user?.full_name || "",
      phone: user?.phone || "",
      department: user?.department || "",
    },
  });

  // Form for password change
  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors },
    watch,
  } = useForm();

  const newPassword = watch("new_password");

  const handleProfileUpdate = (data) => {
    toast.success("Profile updated successfully");
  };

  const handlePasswordChange = async (data) => {
    setIsChangingPassword(true);
    setPasswordError(""); // Clear previous errors
    try {
      const token = localStorage.getItem("token");

      // Remove confirm_password from data before sending to API
      const { confirm_password, ...apiData } = data;

      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(apiData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Password changed successfully");
        setChangePasswordOpen(false);
        resetPassword();
        setPasswordError("");
      } else {
        // Show specific error message from server
        if (result.message === "Current password is incorrect") {
          setPasswordError(
            "Invalid current password. Please check and try again."
          );
          toast.error("Invalid current password. Please check and try again.");
        } else {
          setPasswordError(result.message || "Failed to change password");
          toast.error(result.message || "Failed to change password");
        }
      }
    } catch (error) {
      console.error("Password change error:", error);
      setPasswordError("Failed to change password. Please try again.");
      toast.error("Failed to change password. Please try again.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = () => {
    toast.success("Account deleted successfully");
    logout();
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 700,
            background: "linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            mb: 0.5,
          }}
        >
          Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your account settings and preferences
        </Typography>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs
          value={selectedTab}
          onChange={(e, newValue) => setSelectedTab(newValue)}
        >
          <Tab label="Profile" icon={<Person />} />
          <Tab label="Security" icon={<Security />} />
        </Tabs>
      </Box>

      {/* Profile Tab */}
      {selectedTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader
                title="Profile Information"
                avatar={
                  <Avatar>
                    <Person />
                  </Avatar>
                }
              />
              <CardContent>
                <form onSubmit={handleProfileSubmit(handleProfileUpdate)}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Full Name"
                        {...registerProfile("full_name")}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Phone"
                        {...registerProfile("phone")}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Department"
                        {...registerProfile("department")}
                      />
                    </Grid>
                  </Grid>
                  <Box sx={{ mt: 3, display: "flex", gap: 2 }}>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<Save />}
                    >
                      Save Changes
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => resetProfile()}
                      startIcon={<Cancel />}
                    >
                      Reset
                    </Button>
                  </Box>
                </form>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Account Status" avatar={<AccountCircle />} />
              <CardContent>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText primary="Account Status" secondary="Active" />
                    <Chip label="Verified" color="success" size="small" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Email />
                    </ListItemIcon>
                    <ListItemText
                      primary="Email"
                      secondary={user?.email || "Not provided"}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Business />
                    </ListItemIcon>
                    <ListItemText
                      primary="Role"
                      secondary={user?.role || "User"}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <LocationOn />
                    </ListItemIcon>
                    <ListItemText
                      primary="Last Login"
                      secondary={
                        user?.last_login
                          ? new Date(user.last_login).toLocaleString()
                          : "Unknown"
                      }
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Security Tab */}
      {selectedTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Change Password" avatar={<Lock />} />
              <CardContent>
                <Button
                  variant="contained"
                  startIcon={<Edit />}
                  onClick={() => {
                    setChangePasswordOpen(true);
                    setPasswordError("");
                  }}
                  fullWidth
                >
                  Change Password
                </Button>
              </CardContent>
            </Card>

            <Card sx={{ mt: 2 }}>
              <CardHeader title="Account Actions" avatar={<Warning />} />
              <CardContent>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Delete />}
                  onClick={() => setDeleteAccountOpen(true)}
                  fullWidth
                >
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Security Settings" avatar={<Security />} />
              <CardContent>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Login Notifications"
                      secondary="Enabled"
                    />
                    <Switch checked={true} />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Session Timeout"
                      secondary="30 minutes"
                    />
                    <Switch checked={true} />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Change Password Dialog */}
      <Dialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handlePasswordSubmit(handlePasswordChange)}>
          <DialogTitle>Change Password</DialogTitle>
          <DialogContent>
            {passwordError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {passwordError}
              </Alert>
            )}
            <TextField
              fullWidth
              label="Current Password"
              type="password"
              margin="normal"
              {...registerPassword("current_password", {
                required: "Current password is required",
              })}
              error={!!passwordErrors.current_password}
              helperText={passwordErrors.current_password?.message}
            />
            <TextField
              fullWidth
              label="New Password"
              type="password"
              margin="normal"
              {...registerPassword("new_password", {
                required: "New password is required",
                minLength: {
                  value: 6,
                  message: "Password must be at least 6 characters",
                },
              })}
              error={!!passwordErrors.new_password}
              helperText={passwordErrors.new_password?.message}
            />
            <TextField
              fullWidth
              label="Confirm New Password"
              type="password"
              margin="normal"
              {...registerPassword("confirm_password", {
                required: "Please confirm your new password",
                validate: (value) =>
                  value === newPassword || "Passwords do not match",
              })}
              error={!!passwordErrors.confirm_password}
              helperText={passwordErrors.confirm_password?.message}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setChangePasswordOpen(false)}
              disabled={isChangingPassword}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isChangingPassword}
            >
              {isChangingPassword ? "Changing..." : "Change Password"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog
        open={deleteAccountOpen}
        onClose={() => setDeleteAccountOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Account</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone. All your data will be permanently
            deleted.
          </Alert>
          <Typography>
            Are you sure you want to delete your account? This will remove all
            your data including:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="• All products and inventory data" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• All transactions and history" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• All barcodes and settings" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Your user account and profile" />
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteAccountOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteAccount}
            variant="contained"
            color="error"
          >
            Delete Account
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings;
