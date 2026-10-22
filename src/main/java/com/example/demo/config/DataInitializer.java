package com.example.demo.config;

import com.example.demo.service.MasterService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements ApplicationRunner {

	private final MasterService masterService;

	public DataInitializer(MasterService masterService) {
		this.masterService = masterService;
	}

	@Override
	public void run(ApplicationArguments args) {
		masterService.initDefaults();
	}
}
