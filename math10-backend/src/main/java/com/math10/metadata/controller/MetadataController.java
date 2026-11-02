package com.math10.metadata.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.documents.entity.DocumentType;
import com.math10.metadata.entity.MetadataOptionEntity;
import com.math10.metadata.repository.MetadataOptionRepository;
import com.math10.roles.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.text.Normalizer;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/metadata")
public class MetadataController {

    private static final String USER_STATUS = "USER_STATUS";
    private static final String COURSE_STATUS = "COURSE_STATUS";
    private static final String PUBLISH_STATUS = "PUBLISH_STATUS";
    private static final String CLASS_STATUS = "CLASS_STATUS";
    private static final String RESOURCE_TYPE = "RESOURCE_TYPE";
    private static final String PROBLEM_DIFFICULTY = "PROBLEM_DIFFICULTY";
    private static final String PROBLEM_KIND = "PROBLEM_KIND";
    private static final String EXAM_PART = "EXAM_PART";
    private static final String DOCUMENT_TYPE = "DOCUMENT_TYPE";
    private static final String DOCUMENT_AUDIENCE = "DOCUMENT_AUDIENCE";
    private static final List<String> CATEGORIES = List.of(
            USER_STATUS,
            COURSE_STATUS,
            PUBLISH_STATUS,
            CLASS_STATUS,
            RESOURCE_TYPE,
            PROBLEM_DIFFICULTY,
            PROBLEM_KIND,
            EXAM_PART,
            DOCUMENT_TYPE,
            DOCUMENT_AUDIENCE
    );

    private final RoleRepository roles;
    private final MetadataOptionRepository metadataOptions;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<MetadataResponse> all() {
        Map<String, List<Option>> grouped = metadataOptions
                .findByCategoryInAndActiveTrueOrderByCategoryAscSortOrderAscValueAsc(CATEGORIES)
                .stream()
                .collect(Collectors.groupingBy(
                        MetadataOptionEntity::getCategory,
                        Collectors.mapping(option -> new Option(option.getValue(), option.getLabel()), Collectors.toList())
                ));

        return ApiResponse.ok("Metadata", new MetadataResponse(
                roles.findAll().stream()
                        .map(role -> new Option(role.getCode(), role.getName()))
                        .toList(),
                options(grouped, USER_STATUS),
                options(grouped, COURSE_STATUS),
                options(grouped, PUBLISH_STATUS),
                options(grouped, CLASS_STATUS),
                options(grouped, RESOURCE_TYPE),
                options(grouped, PROBLEM_DIFFICULTY),
                options(grouped, PROBLEM_KIND),
                options(grouped, EXAM_PART),
                options(grouped, DOCUMENT_TYPE),
                options(grouped, DOCUMENT_AUDIENCE)
        ));
    }

    /** Admin bổ sung loại tài liệu mới (nút "+" ở màn Tài liệu). */
    @PostMapping("/document-types")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ApiResponse<Option> createDocumentType(@RequestBody CreateDocumentTypeRequest request) {
        String label = request == null || request.label() == null ? "" : request.label().trim();
        if (label.isEmpty()) {
            throw new BusinessException("Tên loại tài liệu không được để trống");
        }
        if (label.length() > 255) {
            throw new BusinessException("Tên loại tài liệu quá dài");
        }
        String value = request.value() == null || request.value().isBlank()
                ? maTuTen(label)
                : request.value().trim().toUpperCase();
        if (!DocumentType.hopLe(value)) {
            throw new BusinessException("Mã loại chỉ gồm chữ in hoa, số, dấu gạch dưới, bắt đầu bằng chữ, tối đa 30 ký tự");
        }
        if (metadataOptions.existsByCategoryAndLabelIgnoreCaseAndActiveTrue(DOCUMENT_TYPE, label)) {
            throw new BusinessException("Đã có loại tài liệu tên \"" + label + "\"");
        }
        MetadataOptionEntity option = metadataOptions.findByCategoryAndValue(DOCUMENT_TYPE, value).orElse(null);
        if (option != null && Boolean.TRUE.equals(option.getActive())) {
            throw new BusinessException("Mã loại " + value + " đã tồn tại");
        }
        if (option == null) {
            option = new MetadataOptionEntity();
            option.setCategory(DOCUMENT_TYPE);
            option.setValue(value);
        }
        option.setLabel(label);
        option.setActive(true);
        option.setSortOrder(metadataOptions.maxSortOrder(DOCUMENT_TYPE) + 10);
        metadataOptions.save(option);
        return ApiResponse.ok("Đã thêm loại tài liệu", new Option(option.getValue(), option.getLabel()));
    }

    static String maTuTen(String label) {
        String khongDau = Normalizer.normalize(label.replace('đ', 'd').replace('Đ', 'D'), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        String ma = khongDau.toUpperCase().replaceAll("[^A-Z0-9]+", "_").replaceAll("^_+|_+$", "");
        if (ma.isEmpty() || !Character.isLetter(ma.charAt(0))) {
            ma = "LOAI_" + ma;
        }
        if (ma.length() > 30) {
            ma = ma.substring(0, 30).replaceAll("_+$", "");
        }
        return ma;
    }

    public record CreateDocumentTypeRequest(String label, String value) {
    }

    private static List<Option> options(Map<String, List<Option>> grouped, String category) {
        return grouped.getOrDefault(category, List.of());
    }

    public record MetadataResponse(
            List<Option> roles,
            List<Option> userStatuses,
            List<Option> courseStatuses,
            List<Option> publishStatuses,
            List<Option> classStatuses,
            List<Option> resourceTypes,
            List<Option> problemDifficulties,
            List<Option> problemKinds,
            List<Option> examParts,
            List<Option> documentTypes,
            List<Option> documentAudiences
    ) {
    }

    public record Option(String value, String label) {
    }
}
