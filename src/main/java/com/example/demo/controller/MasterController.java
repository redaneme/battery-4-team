package com.example.demo.controller;

import com.example.demo.entity.Country;
import com.example.demo.service.BusinessException;
import com.example.demo.service.MasterService;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MasterController {

	private final MasterService service;

	public MasterController(MasterService service) {
		this.service = service;
	}

	/** 마스터 화면이 쓰는 입력칸 값과 공장·국가 목록 */
	@GetMapping("/api/master/form")
	public Map<String, Object> form() {
		return Map.of(
				"form", MasterService.toForm(service.currentMaster()),
				"factories", labels(Country.factories()),
				"countries", labels(Arrays.asList(Country.values())));
	}

	@PostMapping("/api/master")
	public ResponseEntity<?> save(@RequestBody Map<String, String> form) {
		try {
			service.updateMaster(form);
			return ResponseEntity.ok(Map.of("message", "마스터 데이터를 저장했습니다"));
		} catch (BusinessException e) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST)
					.body(Map.of("error", e.getMessage(), "conflict", false, "messages", e.getMessages()));
		}
	}

	private static List<Map<String, String>> labels(List<Country> countries) {
		return countries.stream().map(c -> Map.of("name", c.name(), "label", c.getLabel())).toList();
	}
}
