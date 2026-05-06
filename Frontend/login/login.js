"use strict";

document.addEventListener("DOMContentLoaded", () => {
    injectAuthModal();
    checkAuthState();
});

function injectAuthModal() {
    if (document.getElementById("authModal")) return;

    const modalHTML = `
      <div class="modal fade" id="authModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content glass-modal border-0">
            <div class="modal-header border-0 pb-0">
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body pt-0 px-4 pb-4">
              
              <!-- Toggle Tab -->
              <ul class="nav nav-pills nav-fill auth-pills mb-4" id="authTab" role="tablist">
                <li class="nav-item" role="presentation">
                  <button class="nav-link active" id="signup-tab" data-bs-toggle="pill" data-bs-target="#signupPane" type="button" role="tab">Sign Up</button>
                </li>
                <li class="nav-item" role="presentation">
                  <button class="nav-link" id="login-tab" data-bs-toggle="pill" data-bs-target="#loginPane" type="button" role="tab">Login</button>
                </li>
              </ul>

              <div class="tab-content" id="authTabContent">
                <!-- Sign Up Pane -->
                <div class="tab-pane fade show active" id="signupPane" role="tabpanel" tabindex="0">
                  <div class="text-center mb-4">
                    <h3 class="auth-title">Create Account</h3>
                    <p class="auth-sub">Start analyzing your interviews today.</p>
                  </div>
                  <form id="signupForm">
                    <div class="mb-3">
                      <label class="form-label iras-label">Full Name</label>
                      <input type="text" class="form-control iras-input" id="signupName" placeholder="Jon Doe" required>
                    </div>
                    <div class="mb-3">
                      <label class="form-label iras-label">Email</label>
                      <input type="email" class="form-control iras-input" id="signupEmail" placeholder="jon@example.com" required>
                    </div>
                    <div class="mb-4">
                      <label class="form-label iras-label">Password</label>
                      <input type="password" class="form-control iras-input" required>
                    </div>
                    <button type="submit" class="btn iras-btn-primary w-100 py-2">Create Account</button>
                  </form>
                </div>

                <!-- Login Pane -->
                <div class="tab-pane fade" id="loginPane" role="tabpanel" tabindex="0">
                  <div class="text-center mb-4">
                    <h3 class="auth-title">Welcome Back</h3>
                    <p class="auth-sub">Log in to view your past analyses.</p>
                  </div>
                  <form id="loginForm">
                    <div class="mb-3">
                      <label class="form-label iras-label">Email</label>
                      <input type="email" class="form-control iras-input" id="loginEmail" placeholder="jon@example.com" required>
                    </div>
                    <div class="mb-4">
                      <label class="form-label iras-label">Password</label>
                      <input type="password" class="form-control iras-input" required>
                    </div>
                    <button type="submit" class="btn iras-btn-primary w-100 py-2">Log In</button>
                  </form>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById("signupForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("signupName").value;
        const email = document.getElementById("signupEmail").value;
        handleLoginSuccess({ name, email });
    });
    document.getElementById("loginForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const email = document.getElementById("loginEmail").value;
        const rawName = email.split('@')[0];
        const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        handleLoginSuccess({ name, email });
    });
}

function handleLoginSuccess(userObj) {
    localStorage.setItem("iras_user", JSON.stringify(userObj));
    const modalEl = document.getElementById('authModal');
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.hide();
    checkAuthState();
}

window.handleLogout = function() {
    localStorage.removeItem("iras_user");
    checkAuthState();
};

window.openAuthModal = function(type = 'signup') {
    const modalEl = document.getElementById('authModal');
    if (!modalEl) return;
    
    const tabEl = document.getElementById(type + '-tab');
    if (tabEl) {
        const tab = new bootstrap.Tab(tabEl);
        tab.show();
    }
    
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
};

function checkAuthState() {
    const container = document.getElementById("authContainer");
    if (!container) return;
    const userData = localStorage.getItem("iras_user");
    const navLeft = document.querySelector(".glass-navbar .nav-left");
    let transcribeLink = document.getElementById("navTranscribe");

    if (userData) {
        if (navLeft && !transcribeLink) {
            transcribeLink = document.createElement("a");
            transcribeLink.id = "navTranscribe";
            transcribeLink.href = "transcribe.html";
            transcribeLink.className = "nav-link";
            transcribeLink.textContent = "Transcript";
            if (window.location.pathname.includes("transcribe.html")) {
                transcribeLink.classList.add("active");
            }
            navLeft.appendChild(transcribeLink);
        }

        const user = JSON.parse(userData);
        let initials = user.name.substring(0, 2).toUpperCase();
        
        container.innerHTML = `
            <div class="dropdown">
              <button class="btn profile-pill dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                <div class="profile-avatar">${initials}</div>
                <span class="profile-name ms-2">${user.name}</span>
              </button>
              <ul class="dropdown-menu dropdown-menu-end glass-dropdown mt-3">
                <li><a class="dropdown-item" href="#"><i class="bi bi-person me-2"></i>My Profile</a></li>
                <li><a class="dropdown-item" href="#"><i class="bi bi-clock-history me-2"></i>Past Analyses</a></li>
                <li><hr class="dropdown-divider border-secondary mx-3"></li>
                <li><a class="dropdown-item text-danger" href="#" onclick="window.handleLogout(); return false;"><i class="bi bi-box-arrow-right me-2"></i>Log Out</a></li>
              </ul>
            </div>
        `;
    } else {
        if (transcribeLink) {
            transcribeLink.remove();
        }

        container.innerHTML = `
            <button onclick="window.openAuthModal('login')" class="btn btn-link nav-link text-decoration-none me-4 p-0">Login</button>
            <button onclick="window.openAuthModal('signup')" class="btn iras-btn-primary rounded-pill">Sign Up</button>
        `;
    }
}