package com.example.demo.controller;

import com.example.demo.entity.Country;
import com.example.demo.service.BusinessException;
import com.example.demo.service.MasterService;
import java.util.Map;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
public class MasterController {

	private final MasterService service;

	public MasterController(MasterService service) {
		this.service = service;
	}

	@GetMapping("/master")
	public String master(Model model) {
		if (!model.containsAttribute("form")) {
			model.addAttribute("form", MasterService.toForm(service.currentMaster()));
		}
		addMasterModel(model);
		return "master";
	}

	@PostMapping("/master")
	public String saveMaster(@RequestParam Map<String, String> form, Model model, RedirectAttributes redirect) {
		try {
			service.updateMaster(form);
		} catch (BusinessException e) {
			model.addAttribute("errors", e.getMessages());
			model.addAttribute("form", form);
			addMasterModel(model);
			return "master";
		}
		redirect.addFlashAttribute("message", "마스터 데이터를 저장했습니다");
		return "redirect:/master";
	}

	/** 마스터 화면이 쓰는 공장·국가 목록 */
	private static void addMasterModel(Model model) {
		model.addAttribute("factories", Country.factories());
		model.addAttribute("countries", Country.values());
	}
}
