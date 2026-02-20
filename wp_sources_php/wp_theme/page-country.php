<?php
/*
Template name: Страница страны
*/
?>
    <!DOCTYPE html>
<html data-wf-page="683ea4aeb9508770dbce63b8" data-wf-site="683ea4aeb9508770dbce633f">
	<?php get_template_part("header_block", ""); ?>
	<body>
<?php if(function_exists('get_field')) { echo get_field('body_code', 'option'); } ?>

		<div class="navbar-wrapper">
			<div class="container">
				<div class="navbar"><a href="<?php echo get_home_url() ?>" class="logo-wrapper w-inline-block"><img loading="lazy" alt="<?php echo !empty($field['alt']) ? esc_attr($field['alt']) : ''; ?>" src="<?php $field = get_field('logo', 'options'); if(isset($field['url'])){ echo($field['url']); }elseif(is_numeric($field)){ echo(wp_get_attachment_image_url($field, 'full')); }else{ echo($field); } ?>" class="image"></a>
					<div class="navbar-inner">
						<div class="nav-links-wrapper">
							<div class="nav-links"><a href="/" class="nav-link">Главная</a>
								<div data-delay="0" data-hover="true" class="dropdown w-dropdown">
									<div class="dropdown-toggle w-dropdown-toggle">
										<div>Каталог</div><img loading="lazy" src="<?php echo get_template_directory_uri() ?>/images/683eaa470902760dca70893b_down.png" alt class="image-2"></div>
									<nav class="dropdown-list w-dropdown-list"><a href="/japan/" class="dropdown-link w-dropdown-link">Авто из Японии</a><a href="/korea/" class="dropdown-link w-dropdown-link">Авто из Кореи</a><a href="/china/" class="dropdown-link w-dropdown-link">Авто из Китая</a><a href="/bike/" class="dropdown-link w-dropdown-link">Мотоциклы</a><a href="https://auc.asiaexpressauto.ru/" target="_blank" class="dropdown-link w-dropdown-link">Аукционы Японии</a></nav>
								</div><a href="/about/" class="nav-link">О нас</a><a href="/blog/" class="nav-link">Статьи</a><a href="/review/" class="nav-link">Отзывы</a><a href="/contact/" class="nav-link">Контакты</a>
								<div data-delay="0" data-hover="true" class="dropdown w-dropdown">
									<div class="dropdown-toggle w-dropdown-toggle">
										<div>Где мы находимся</div><img loading="lazy" src="<?php echo get_template_directory_uri() ?>/images/683eaa470902760dca70893b_down.png" alt class="image-2"></div>
                                    <nav class="dropdown-list-where w-dropdown-list">
                                        <?php /* <?php if( have_rows('filialy', 'options') ){ ?><div class="drop-inner"><?php global $parent_id; if(isset($loop_id)) $parent_id = $loop_id; $loop_index = 0; $loop_title="Филиалы"; $loop_field = "filialy"; while( have_rows('filialy', 'options') ){ global $loop_id; $loop_index++; $loop_id++; the_row(); ?><a href="<?php echo get_sub_field('ssylka_telefona') ?>" class="link-block w-inline-block"><div class="m-16-600"><?php echo get_sub_field('gorod') ?></div><div class="m-14-400"><?php echo get_sub_field('adres') ?></div><div class="m-14-400"><?php echo get_sub_field('nomer_telefona') ?></div><?php if(get_sub_field('is_head_filial')) { echo '<span style="color: rgb(226, 34, 54);">Головной офис</span>';}?></a><?php } ?></div><?php } ?> */ ?>
                                        <?php if( have_rows('filialy', 'options') ){ ?><div class="drop-inner"><?php global $parent_id; if(isset($loop_id)) $parent_id = $loop_id; $loop_index = 0; $loop_title="Филиалы"; $loop_field = "filialy"; while( have_rows('filialy', 'options') ){ global $loop_id; $loop_index++; $loop_id++; the_row(); ?><div class="link-block w-inline-block"><div class="m-16-600"><?php echo get_sub_field('gorod') ?></div><a href="<?php echo get_sub_field('adres_yandexkarty') ?>" target="_blank" class="m-14-400" style="display:block; color:inherit; text-decoration:none;"><?php echo get_sub_field('adres') ?></a><a href="<?php echo get_sub_field('ssylka_telefona') ?>" class="m-14-400" style="display:block; color:inherit; text-decoration:none;"><?php echo get_sub_field('nomer_telefona') ?></a><?php if(get_sub_field('is_head_filial')) { echo '<span style="color: rgb(226, 34, 54);">Головной офис</span>';}?></div><?php } ?></div><?php } ?>
                                    </nav>
								</div>
							</div>
						</div>
						<div class="mess-phone-wrapper mob-hide">
							<?php if( have_rows('messendzhery', 'options') ){ ?><div class="mess-wrapper"><?php global $parent_id; if(isset($loop_id)) $parent_id = $loop_id; $loop_index = 0; $loop_title="Мессенджеры"; $loop_field = "messendzhery"; while( have_rows('messendzhery', 'options') ){ global $loop_id; $loop_index++; $loop_id++; the_row(); ?><a href="<?php echo get_sub_field('ssylka') ?>" target="_blank" class="one-mess w-inline-block"><img loading="lazy" alt="<?php echo !empty($field['alt']) ? esc_attr($field['alt']) : ''; ?>" src="<?php $field = get_sub_field('ikonka'); if(isset($field['url'])){ echo($field['url']); }elseif(is_numeric($field)){ echo(wp_get_attachment_image_url($field, 'full')); }else{ echo($field); } ?>" class="img-mess"></a><?php } ?></div><?php } ?>
							<div class="two-phones"><a href="<?php echo get_field('ssylka_telefona', 'options') ?>" target="_blank" class="phone-wrapper w-inline-block"><div class="text-block-2"><?php echo get_field('nomer_telefona', 'options') ?></div></a><a href="<?php echo get_field('ssylka_telefona_2', 'options') ?>" target="_blank" class="phone-wrapper w-inline-block"><div class="text-block-2"><?php echo get_field('nomer_telefona_2', 'options') ?></div></a></div>
						</div>
					</div>
					<div class="nav-mess-mob">
						<div class="mess-phone-wrapper">
							<?php if( have_rows('messendzhery', 'options') ){ ?><div class="mess-wrapper"><?php global $parent_id; if(isset($loop_id)) $parent_id = $loop_id; $loop_index = 0; $loop_title="Мессенджеры"; $loop_field = "messendzhery"; while( have_rows('messendzhery', 'options') ){ global $loop_id; $loop_index++; $loop_id++; the_row(); ?><a href="<?php echo get_sub_field('ssylka') ?>" target="_blank" class="one-mess w-inline-block"><img loading="lazy" alt="<?php echo !empty($field['alt']) ? esc_attr($field['alt']) : ''; ?>" src="<?php $field = get_sub_field('ikonka'); if(isset($field['url'])){ echo($field['url']); }elseif(is_numeric($field)){ echo(wp_get_attachment_image_url($field, 'full')); }else{ echo($field); } ?>" class="img-mess"></a><?php } ?></div><?php } ?><a href="<?php echo get_field('ssylka_telefona', 'options') ?>" target="_blank" class="phone-wrapper w-inline-block"><div class="text-block-2"><?php echo get_field('nomer_telefona', 'options') ?></div></a></div>
						<div class="burger-wrapper"><img src="<?php echo get_template_directory_uri() ?>/images/685524f88bbba1d619603a9a_menu20(3).png" loading="lazy" data-w-id="90648415-56b6-e798-0386-e789320e2a1e" alt class="burger"><img src="<?php echo get_template_directory_uri() ?>/images/6855257cec3a608bc6b1a834_close20(17).png" loading="lazy" data-w-id="1e13c1bc-e79c-5240-0430-5c6f15709f05" alt class="close"></div>
					</div>
				</div>
			</div>
		</div>
		<section class="section catalogue gray-new top-100">
			<div class="container">
				<div class="catalogue-wrapper">
					<?php
					// Определяем рынок по слагу страницы
					$page_slug = get_post_field('post_name', get_post());
					$current_market = 'main'; // по умолчанию Япония

					switch($page_slug) {
						case 'japan':
							$current_market = 'main';
							break;
						case 'korea':
							$current_market = 'korea';
							break;
						case 'china':
							$current_market = 'china';
							break;
						case 'bike':
						    $current_market = 'bike';
							break;
						case 'che_available':
						    $current_market = 'che_available';
							break;
						default:
							// Попробуем получить из мета поля
							$market_field = get_field('market_type');
							if ($market_field) {
								$current_market = $market_field;
							}
							break;
					}

					// Используем плагин Car Auction с темовым стилем
					echo do_shortcode('[car_auction_search market="' . $current_market . '" view="grid" show_filters="yes" style="theme"]');
					?>
				</div>
			</div>
		</section>
		
		<?php /*
		<section class="section stdrt gray-new">
			<div class="container">
				<div class="catalogue-text-wrapper-country">
					<div class="h2-wrapper">
						<h2 class="h2"><?php echo get_field('seo_zagolovok') ?></h2>
					</div>
					<div class="catalogue-text">
						<div class="m-16-400 w-richtext"><?php echo get_field('seo_tekst') ?></div>
					</div>
				</div>
				<div class="h2-wrapper">
					<h2 class="h2"><?php echo get_field('zagolovok_2') ?></h2>
				</div>
				<?php if( have_rows('preimuschestva') ){ ?><div class="benefits-wrapper"><?php global $parent_id; if(isset($loop_id)) $parent_id = $loop_id; $loop_index = 0; $loop_title="Преимущества"; $loop_field = "preimuschestva"; while( have_rows('preimuschestva') ){ global $loop_id; $loop_index++; $loop_id++; the_row(); ?>
					<div class="one-benefit">
						<div class="icon-main">
							<div class="icon-wrapper"><img loading="lazy" alt="<?php echo !empty($field['alt']) ? esc_attr($field['alt']) : ''; ?>" src="<?php $field = get_sub_field('ikonka'); if(isset($field['url'])){ echo($field['url']); }elseif(is_numeric($field)){ echo(wp_get_attachment_image_url($field, 'full')); }else{ echo($field); } ?>" class="icon"></div>
							<h3 class="h4"><?php echo get_sub_field('zagolovok') ?></h3>
						</div>
						<div class="m-16-400"><?php echo get_sub_field('tekst') ?></div>
					</div>
					
					
					
					
					
				<?php } ?></div><?php } ?>
			</div>
		</section>
		<section class="section stdrt">
			<div class="container">
				<div class="h2-wrapper p-70">
					<h2 class="h2"><?php echo get_field('zagolovok_3') ?></h2>
				</div>
				<?php if( have_rows('faq') ){ ?><div class="faq-wrapper"><?php global $parent_id; if(isset($loop_id)) $parent_id = $loop_id; $loop_index = 0; $loop_title="FAQ"; $loop_field = "faq"; while( have_rows('faq') ){ global $loop_id; $loop_index++; $loop_id++; the_row(); ?>
					<div class="one-question">
						<div data-w-id="816006eb-5612-0d74-f3df-37418c5753af" class="q-top">
							<h4 class="h4"><?php echo get_sub_field('vopros') ?></h4>
							<div class="plus-wrapper"><img alt src="<?php echo get_template_directory_uri() ?>/images/6850257a398f5d5942a8baef_plus20(1).png" loading="lazy" class="plus-img"></div>
						</div>
						<div style="height:0px" class="q-bottom">
							<div class="answer-wrapper">
								<div class="m-16-400"><?php echo get_sub_field('otvet') ?></div>
							</div>
						</div>
					</div>
					
					
				<?php } ?></div><?php } ?>
				<div class="more-questions">
					<div class="m-16-600 gray"><?php echo get_field('ostalis_voprosy') ?></div>
				</div>
			</div>
		</section>
		*/ ?>
		
		<section class="section stdrt footer">
			<div class="container">
				<div class="footer-wrapper">
					<div class="footer-col"><img src="<?php echo get_template_directory_uri() ?>/images/6851a7fcfab571d5568fab7c_aea-white.png" loading="lazy" alt class="logo-footer">
						<div class="m-14-400 white">Подбор и доставка автомобилей <br>из Китая, Кореи и Японии в Россию!</div>
					</div>
					<div class="footer-col">
						<div class="m-16-600 white">Навигация:</div>
						<div class="footer-links-wrapper"><a href="/" class="m-14-400 white">Главная</a><a href="/japan/" class="m-14-400 white">Авто из Японии</a><a href="/korea/" class="m-14-400 white">Авто из Кореи</a><a href="/china/" class="m-14-400 white">Авто из Китая</a><a href="/bike/" class="m-14-400 white">Мотоциклы</a><a href="https://auc.asiaexpressauto.ru/" class="m-14-400 white">Аукционы Японии</a><a href="/about/" class="m-14-400 white">О нас</a><a href="/blog/" class="m-14-400 white">Статьи</a><a href="/contact/" class="m-14-400 white">Контакты</a></div>
					</div>
					<div class="footer-col">
						<div class="m-16-600 white">Контакты:</div>
						<div class="footer-contacts-wrapper">
							<div class="team-phone-wrapper"><img src="<?php echo get_template_directory_uri() ?>/images/684aa13ecb3c5af991d079ef_phone-call20(3).png" loading="lazy" alt class="phone-img"><a href="<?php echo get_field('ssylka_telefona_1', 'options') ?>" class="link white"><?php echo get_field('nomer_telefona_1', 'options') ?></a><a href="#" class="one-mess-team w-inline-block"></a><a href="#" class="one-mess-team w-inline-block"></a></div>
							<div class="team-phone-wrapper"><img src="<?php echo get_template_directory_uri() ?>/images/684aa13ecb3c5af991d079ef_phone-call20(3).png" loading="lazy" alt class="phone-img"><a href="<?php echo get_field('ssylka_telefona_2', 'options') ?>" class="link white"><?php echo get_field('nomer_telefona_2', 'options') ?></a><a href="#" class="one-mess-team w-inline-block"></a><a href="#" class="one-mess-team w-inline-block"></a></div>
							<div class="team-phone-wrapper"><img src="<?php echo get_template_directory_uri() ?>/images/6852368fa1db44eaf02f21b9_whatsapp20(9).png" loading="lazy" alt class="phone-img"><a href="<?php echo get_field('ssylka_votsap', 'options') ?>" class="link white"><?php echo get_field('nomer_votsap', 'options') ?></a><a href="#" class="one-mess-team w-inline-block"></a><a href="#" class="one-mess-team w-inline-block"></a></div>
						</div>
						<div class="m-16-600 white">Соцсети:</div>
						<div class="footer-social"><a href="<?php echo get_field('ssylka_telegram', 'options') ?>" class="soc-link-footer w-inline-block"><img src="<?php echo get_template_directory_uri() ?>/images/685237d489ad251ad859bbea_communication20(1).png" loading="lazy" alt class="soc-img tg"></a><a href="<?php echo get_field('ssylka_instagram', 'options') ?>" class="soc-link-footer w-inline-block"><img src="<?php echo get_template_directory_uri() ?>/images/6852388e1605d036cc077bbc_instagram20(4).png" loading="lazy" alt class="soc-img"></a><a href="<?php echo get_field('ssylka_yutub', 'options') ?>" class="soc-link-footer w-inline-block"><img src="<?php echo get_template_directory_uri() ?>/images/685238dfa5a22944c4c072a9_youtube20(4).png" loading="lazy" alt class="soc-img"></a><a href="<?php echo get_field('ssylka_vk', 'options') ?>" class="soc-link-footer w-inline-block"><img src="<?php echo get_template_directory_uri() ?>/images/685239673990a1d1e304a9da_vk20(2).png" loading="lazy" alt class="soc-img"></a><a href="<?php echo get_field('ssylka_rutub', 'options') ?>" class="soc-link-footer w-inline-block"><img src="<?php echo get_template_directory_uri() ?>/images/68523a42584a7ad3fa6ce063_Minilogo_RUTUBE.png" loading="lazy" alt class="soc-img"></a></div>
					</div>
					<div class="footer-col">
						<div class="m-16-600 white">Информация:</div>
						<div class="team-phone-wrapper"><img src="<?php echo get_template_directory_uri() ?>/images/68523af9cb88a20df9ae6eff_email20(3).png" loading="lazy" alt class="phone-img"><a href="<?php echo get_field('ssylka_mejl', 'options') ?>" class="link white m-sm"><?php echo get_field('adres_mejl', 'options') ?></a><a href="#" class="one-mess-team w-inline-block"></a><a href="#" class="one-mess-team w-inline-block"></a></div>
						<div class="team-phone-wrapper"><img src="<?php echo get_template_directory_uri() ?>/images/68523b775b3994ae8cc2f391_location-pin20(1).png" loading="lazy" alt class="phone-img">
							<div class="link white m-sm"><?php echo get_field('adres', 'options') ?></div>
						</div>
						<div class="politics-wrpper"><a href="<?php echo get_field('', 'options') ?>" class="m-14-400 white">Политика конфиденциальности</a><a href="<?php echo get_field('', 'options') ?>" class="m-14-400 white">Реквизиты</a></div>
					</div>
				</div>
			</div>
		</section>






<script type="text/javascript">
    // Подключаем локализацию для AJAX
    if (typeof carAuction === 'undefined') {
        window.carAuction = {
            ajaxUrl: '<?php echo admin_url('admin-ajax.php'); ?>',
            nonce: '<?php echo wp_create_nonce('car_auction_nonce'); ?>',
            loading: 'Загрузка...',
            noResults: 'Ничего не найдено'
        };
    }
</script>
<!-- FOOTER CODE --><?php get_template_part("footer_block", ""); ?>
<script type="text/javascript" src="<?php bloginfo('template_url'); ?>/js/page-country.js?ver=1759315945"></script></body>
</html>
