package com.example.demo;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.demo.entity.Country;
import com.example.demo.service.MasterService;
import com.example.demo.simulation.Master;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class MasterFormTests {

	@Autowired
	MasterService masterService;

	/** DB 상태와 무관하게, 직접 만든 Master 가 화면 입력칸 이름·값으로 바뀌는지 본다. */
	@Test
	void toFormMapsMasterToInputNamesAndEokUnit() {
		Master m = new Master(1, 3, 300_000_000L,
				List.of(new Master.FactoryParam(Country.CHINA, 400, 4000, 700)),
				List.of(new Master.RouteParam(Country.KOREA, Country.CHINA, 1)));

		Map<String, String> form = masterService.toForm(m);

		assertThat(form).containsEntry("maxDaily_CHINA", "400")
				.containsEntry("stockLimit_CHINA", "4000")
				.containsEntry("unitCost_CHINA", "700")
				.containsEntry("days_KOREA_CHINA", "1")
				.containsEntry("shipCount", "3")
				.containsEntry("shipDailyCost", "3");
	}
}
