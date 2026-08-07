package com.math10.worksheets.repository;
import com.math10.worksheets.entity.WorksheetItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface WorksheetItemRepository extends JpaRepository<WorksheetItem,Long>{List<WorksheetItem> findByWorksheetIdOrderByOrderIndex(Long id);}
