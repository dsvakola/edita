<?php
// Simple enquiry form handler
$name  = htmlspecialchars($_POST['name'] ?? '');
$email = filter_var($_POST['email'] ?? '', FILTER_VALIDATE_EMAIL);

if ($name && $email) {
    $message = "New enquiry from $name ($email)";
    echo "<p class='success'>Thank you, $name! We will contact you soon.</p>";
} else {
    echo "<p class='error'>Please enter your name and a valid e-mail.</p>";
}
?>
