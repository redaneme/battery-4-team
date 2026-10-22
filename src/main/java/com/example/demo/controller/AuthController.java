package com.example.demo.controller;

import com.example.demo.config.LoginInterceptor;
import jakarta.servlet.http.HttpSession;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.SessionAttribute;

@RestController
public class AuthController {

	private static final String ACCOUNT = "admin";

	public record LoginRequest(String username, String password) {
	}

	@PostMapping("/api/login")
	public ResponseEntity<?> login(@RequestBody LoginRequest request, HttpSession session) {
		if (ACCOUNT.equals(request.username()) && ACCOUNT.equals(request.password())) {
			session.setAttribute(LoginInterceptor.SESSION_USER, request.username());
			return ResponseEntity.ok(Map.of("username", request.username()));
		}
		return ResponseEntity.status(HttpStatus.BAD_REQUEST)
				.body(Map.of("error", "아이디 또는 비밀번호가 올바르지 않습니다", "conflict", false));
	}

	@PostMapping("/api/logout")
	public Map<String, Object> logout(HttpSession session) {
		session.invalidate();
		return Map.of();
	}

	/** 화면 상단에 보여 줄 로그인한 아이디 */
	@GetMapping("/api/me")
	public Map<String, String> me(@SessionAttribute(name = LoginInterceptor.SESSION_USER) String user) {
		return Map.of("username", user);
	}
}
